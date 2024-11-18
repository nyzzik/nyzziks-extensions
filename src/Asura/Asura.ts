/* eslint-disable linebreak-style */
import {
    BasicRateLimiter,
    Chapter,
    ChapterDetails,
    ChapterProviding,
    CloudflareBypassRequestProviding,
    Cookie,
    DiscoverSection,
    DiscoverSectionItem,
    DiscoverSectionProviding,
    DiscoverSectionType,
    Extension,
    Form,
    MangaProviding,
    PagedResults,
    SearchQuery,
    SearchResultItem,
    SearchResultsProviding,
    SettingsFormProviding,
    SourceManga,
    TagSection
} from '@paperback/types'

import * as cheerio from 'cheerio'

import {
    isLastPage,
    parseChapterDetails,
    parseChapters,
    parseMangaDetails,
    parseSearch,
    parseTags,
    parseFeaturedSection,
    parseUpdateSection,
    parsePopularSection
} from './AsuraParser'

import {
    getFilterTagsBySection,
    URLBuilder
} from './AsuraHelper'
import { setFilters } from './AsuraUtils'

import { AsuraInterceptor } from './AsuraInterceptor'
import { AS_API_DOMAIN, AS_DOMAIN } from './AsuraConfig'
import { AsuraSettingForm } from './AsuraSettings'


export class AsuraScans implements Extension, SearchResultsProviding, MangaProviding, ChapterProviding, SettingsFormProviding, CloudflareBypassRequestProviding, DiscoverSectionProviding {

    cloudflareBypassDone = false
    globalRateLimiter = new BasicRateLimiter("ratelimiter", {
        numberOfRequests: 4,
        bufferInterval: 1,
        ignoreImages: true,
    })
    requestManager = new AsuraInterceptor("main")



    async initialise(): Promise<void> {
        this.globalRateLimiter.registerInterceptor();
        this.requestManager.registerInterceptor()
        if(Application.isResourceLimited) return;


        for(const tags of await this.getSearchTags()) {
            Application.registerSearchFilter({
                type: "multiselect",
                options: tags.tags.map((x) => ({ id: x.id, value: x.title })),
                id: tags.id,
                allowExclusion: false,
                title: tags.title,
                value: {},
                allowEmptySelection: true,
                maximum: undefined,
            })
        }

    }

    async getDiscoverSections(): Promise<DiscoverSection[]> {

        return [{
            id: 'featured',
            title: 'Featured',
            type: DiscoverSectionType.featured
        },

        {
            id: 'latest_updates',
            title: 'Latest Updates',
            // containsMoreItems: true,
            type: DiscoverSectionType.simpleCarousel
        },

        {
            id: 'popular_today',
            title: 'Popular Today',
            type: DiscoverSectionType.chapterUpdates
        },

        {
            id: 'type',
            title: "Types",
            type: DiscoverSectionType.genres
        },

        {
            id: 'genres',
            title: 'Genres',
            type: DiscoverSectionType.genres
        },

        {
            id: 'status',
            title: 'Status',
            type: DiscoverSectionType.genres
        }]
    }
    async getDiscoverSectionItems(section: DiscoverSection, metadata: unknown | undefined): Promise<PagedResults<DiscoverSectionItem>> {
        let items: DiscoverSectionItem[] = []
        switch(section.type) {
            case DiscoverSectionType.featured:
                const featureResponse = await Application.scheduleRequest({
                    url: AS_DOMAIN,
                    method: 'GET'
                })
                const f$ = cheerio.load(Application.arrayBufferToUTF8String(featureResponse[1]))
                items = await parseFeaturedSection(f$)
                break
            case DiscoverSectionType.chapterUpdates:
                const updateResponse = await Application.scheduleRequest({
                    url: AS_DOMAIN,
                    method: 'GET'
                })
                const u$ = cheerio.load(Application.arrayBufferToUTF8String(updateResponse[1]))
                items = await parsePopularSection(u$)
                break
            case DiscoverSectionType.simpleCarousel:
                const popularResponse = await Application.scheduleRequest({
                    url: AS_DOMAIN,
                    method: 'GET'
                })
                const p$ = cheerio.load(Application.arrayBufferToUTF8String(popularResponse[1]))
                items = await parseUpdateSection(p$)
                break;
            case DiscoverSectionType.genres:
                if(section.id === 'type') {
                    items = []
                    const tags: TagSection[] = await this.getSearchTags();
                    for(let tag of tags[2].tags) {
                        items.push({
                            type: "genresCarouselItem",
                            searchQuery: {
                                title: tag.title,
                                filters: [{
                                    id: tag.id, value: {
                                        [tag.id]: "included"
                                    },
                                }],
                            },
                            name: tag.title,
                            metadata: metadata,
                        })
                    }
                }
                if(section.id === 'genres') {

                    items = []
                    const tags: TagSection[] = await this.getSearchTags();
                    for(let tag of tags[0].tags) {
                        items.push({
                            type: "genresCarouselItem",
                            searchQuery: {
                                title: tag.title,
                                filters: [{
                                    id: tag.id, value: {
                                        [tag.id]: "included"
                                    },
                                }],
                            },
                            name: tag.title,
                            metadata: metadata,
                        })
                    }
                }
                if(section.id === 'status') {
                    items = []
                    const tags: TagSection[] = await this.getSearchTags();
                    for(let tag of tags[1].tags) {
                        items.push({
                            type: "genresCarouselItem",
                            searchQuery: {
                                title: tag.title,
                                filters: [{
                                    id: tag.id, value: {
                                        [tag.id]: "included"
                                    },
                                }],
                            },
                            name: tag.title,
                            metadata: metadata,
                        })
                    }
                }
        }
        return { items, metadata }

    }
    async getSettingsForm(): Promise<Form> {
        return new AsuraSettingForm
    }
    async saveCloudflareBypassCookies(cookies: Cookie[]): Promise<void> {
        this.cloudflareBypassDone = true;
    }

    getMangaShareUrl(mangaId: string): string { return `${AS_DOMAIN}/series/${mangaId}` }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {

        const request = {
            url: new URLBuilder(AS_DOMAIN)
                .addPathComponent("series")
                .addPathComponent(mangaId)
                .buildUrl(),
            method: 'GET'
        }

        const [response, buffer] = await Application.scheduleRequest(request)

        const $ = cheerio.load(Application.arrayBufferToUTF8String(buffer))
        return await parseMangaDetails($, mangaId)
    }

    async getChapters(sourceManga: SourceManga, sinceDate?: Date | undefined): Promise<Chapter[]> {

        const request = {
            url: new URLBuilder(AS_DOMAIN)
                .addPathComponent("series")
                .addPathComponent(sourceManga.mangaId)
                .buildUrl(),
            method: 'GET'
        }
        const [response, buffer] = await Application.scheduleRequest(request)
        const $ = cheerio.load(Application.arrayBufferToUTF8String(buffer))
        return parseChapters($, sourceManga)
    }

    async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {

        const request = {
            url: new URLBuilder(AS_DOMAIN)
                .addPathComponent("series")
                .addPathComponent(chapter.sourceManga.mangaId)
                .addPathComponent("chapter")
                .addPathComponent(chapter.chapterId)
                .buildUrl(),
            method: 'GET'
        }

        const [response, buffer] = await Application.scheduleRequest(request)
        const $ = cheerio.load(Application.arrayBufferToUTF8String(buffer))
        return parseChapterDetails($, chapter.sourceManga.mangaId, chapter.chapterId)
    }

    async getGenres(): Promise<string[]> {
        try {
            const request = {
                url: new URLBuilder(AS_API_DOMAIN)
                    .addPathComponent("api")
                    .addPathComponent("series")
                    .addPathComponent("filters")
                    .buildUrl(),
                method: 'GET',
            }

            const [response, buffer] = await Application.scheduleRequest(request)
            const data = JSON.parse(Application.arrayBufferToUTF8String(buffer))
            return data.genres?.values();

        } catch(error) {
            throw new Error(error as string)
        }
    }

    async getSearchTags(): Promise<TagSection[]> {
        console.log('search tag soup')
        try {
            // const response = await Application.scheduleRequest({
            //     url: `${AS_API_DOMAIN}/api/series/filters`,
            //     method: 'GET'
            // })

            const request = {
                url: new URLBuilder(AS_API_DOMAIN)
                    .addPathComponent("api")
                    .addPathComponent("series")
                    .addPathComponent("filters")
                    .buildUrl(),
                method: 'GET'
            }

            const [response, buffer] = await Application.scheduleRequest(request)
            const data = JSON.parse(Application.arrayBufferToUTF8String(buffer))

            // Set filters for mangaDetails
            await setFilters(data)

            return parseTags(data)
        } catch(error) {
            throw new Error(error as string)
        }
    }

    async supportsTagExclusion(): Promise<boolean> {
        return false
    }

    async getSearchResults(query: SearchQuery, metadata: any): Promise<PagedResults<SearchResultItem>> {
        const page: number = metadata?.page ?? 1

        let urlBuilder: URLBuilder = new URLBuilder(AS_DOMAIN)
            .addPathComponent('series')
            .addQueryParameter('page', page.toString())

        if(query?.title) {
            urlBuilder = urlBuilder.addQueryParameter('name', encodeURIComponent(query?.title.replace(/[’‘´`'-][a-z]*/g, '%') ?? ''))
        }
        const includedTags = [];
        const excludedTags = [];
        for(const filter of query.filters) {
            const tags = (filter.value ?? {}) as Record<
                string,
                "included" | "excluded"
            >;
            for(const tag of Object.entries(tags)) {
                includedTags.push(tag[0]);
            }

        }

        urlBuilder = urlBuilder
            .addQueryParameter('genres', getFilterTagsBySection('genres', includedTags))
            .addQueryParameter('status', getFilterTagsBySection('status', includedTags))
            .addQueryParameter('types', getFilterTagsBySection('type', includedTags))
            .addQueryParameter('order', getFilterTagsBySection('order', includedTags))

        let url: string = urlBuilder.buildUrl();
        const response = await Application.scheduleRequest({
            url,
            method: 'GET'
        })

        // const response = await this.requestManager.schedule(request, 1)
        const $ = cheerio.load(Application.arrayBufferToUTF8String(response[1]))

        const items = await parseSearch(this, $)
        metadata = !isLastPage($) ? { page: page + 1 } : undefined
        return {
            items,
            metadata
        }
    }


}