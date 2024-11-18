import {
    Chapter,
    ChapterDetails,
    SourceManga,
    TagSection,
    Tag,
    ContentRating,
    DiscoverSectionItem,
    DiscoverSection,
    DiscoverSectionType,
    SearchResultItem,
} from '@paperback/types'

import { decode as decodeHTMLEntity } from 'html-entities'
import { CheerioAPI } from 'cheerio'

import {
    getFilter,
    getMangaId
} from './AsuraUtils'

import { Filters } from './interface/Filters'


export const parseMangaDetails = async ($: CheerioAPI, mangaId: string): Promise<SourceManga> => {

    const title = $('.text-center > .text-xl.font-bold').text().trim() ?? ''
    const image = $('img[alt="poster"]').attr('src') ?? ''
    const description = $('span.font-medium.text-sm').text().trim() ?? ''

    const author = $('h3:contains("Author")').next().text().trim() ?? ''
    const artist = $('h3:contains("Author")').next().text().trim() ?? ''

    const arrayTags: Tag[] = []
    for(const tag of $('button', $('h3:contains("Genres")').next()).toArray()) {
        const label = $(tag).text().trim()
        const filterName = label.toLocaleUpperCase()

        const id = await getFilter(filterName)

        if(!id || !label) continue
        arrayTags.push({ id: `genres:${id}`, title: label })
    }
    const tagSections: TagSection[] = [{ id: '0', title: 'genres', tags: arrayTags }]

    const rawStatus = $('h3:contains("Status")').next().text().trim() ?? ''
    let status = 'ONGOING'
    switch(rawStatus.toUpperCase()) {
        case 'ONGOING':
            status = 'Ongoing'
            break
        case 'COMPLETED':
            status = 'Completed'
            break
        case 'HIATUS':
            status = 'Hiatus'
            break
        case 'SEASON END':
            status = 'Season End'
            break
        case 'COMING SOON':
            status = 'Coming Soon'
            break
        default:
            status = 'Ongoing'
            break
    }

    let titles = [decodeHTMLEntity(title)];

    return {
        mangaId: mangaId,
        mangaInfo: {
            primaryTitle: titles.shift() as string,
            secondaryTitles: titles,
            status: status,
            author: decodeHTMLEntity(author),
            artist: decodeHTMLEntity(artist),
            tagGroups: tagSections,
            synopsis: decodeHTMLEntity(description),
            thumbnailUrl: 'image',
            contentRating: ContentRating.EVERYONE
        }
    }
}
/*
thumbnailUrl: string;
  synopsis: string;
  primaryTitle: string;
  secondaryTitles: string[];
  contentRating: ContentRating;

  status?: string;
  artist?: string;
  author?: string;
  bannerUrl?: string;
  rating?: number;
  tagGroups?: TagSection[];
  artworkUrls?: string[];
  additionalInfo?: Record<string, string>;
*/



export const parseChapters = ($: CheerioAPI, sourceManga: SourceManga): Chapter[] => {
    const chapters: Chapter[] = []
    let sortingIndex = 0

    for(const chapter of $('div', 'div.pl-4.pr-2.pb-4.overflow-y-auto').toArray()) {
        const id = $('a', chapter).attr('href')?.replace(/\/$/, '')?.split('/').pop()?.trim() ?? ''

        if(!id || isNaN(Number(id))) continue

        const rawDate = $('h3', chapter).last().text().trim() ?? ''
        const date = new Date(rawDate.replace(/\b(\d+)(st|nd|rd|th)\b/g, '$1'))

        chapters.push({
            chapterId: id,
            title: `Chapter ${id}`,
            langCode: '🇬🇧',
            chapNum: Number(id),
            volume: 0,
            publishDate: date,
            sortingIndex,
            sourceManga
        })
        sortingIndex--
    }

    if(chapters.length == 0) {
        throw new Error(`Couldn't find any chapters for mangaId: ${sourceManga.mangaId}!`)
    }

    return chapters.map(chapter => {
        if(chapter.sortingIndex != undefined)
            chapter.sortingIndex += chapters.length
        return chapter
    })
}

export const parseChapterDetails = async ($: CheerioAPI, mangaId: string, chapterId: string): Promise<ChapterDetails> => {
    const pages: string[] = []

    for(const image of $('img[alt*="chapter"]').toArray()) {
        const img = $(image).attr('src') ?? ''
        if(!img) continue

        pages.push(img)
    }

    const chapterDetails = {
        id: chapterId,
        mangaId: mangaId,
        pages: pages
    }

    return chapterDetails
}

export const parseFeaturedSection = async ($: CheerioAPI): Promise<DiscoverSectionItem[]> => {
    // Featured
    const featuredSection_Array: DiscoverSectionItem[] = []
    for(const manga of $('li.slide', 'ul.slider.animated').toArray()) {
        const slug = $('a', manga).attr('href')?.replace(/\/$/, '')?.split('/').pop() ?? ''
        if(!slug) continue

        const id = await getMangaId(slug)

        // Fix ID later, remove hash
        const image: string = $('img', manga).first().attr('src') ?? ''
        const title: string = $('a', manga).first().text().trim() ?? ''

        if(!id || !title) continue
        featuredSection_Array.push({
            imageUrl: image,
            title: decodeHTMLEntity(title),
            mangaId: id,
            type: 'featuredCarouselItem'
        })
    }
    return featuredSection_Array
}

export const parseUpdateSection = async ($: CheerioAPI): Promise<DiscoverSectionItem[]> => {
    // Latest Updates
    const updateSection_Array: DiscoverSectionItem[] = []
    for(const manga of $('div.w-full', 'div.grid.grid-rows-1').toArray()) {
        const slug = $('a', manga).attr('href')?.replace(/\/$/, '')?.split('/').pop() ?? ''
        if(!slug) continue

        const id = await getMangaId(slug)

        console.log(manga)

        const image: string = $('img', manga).first().attr('src') ?? ''
        const title: string = $('.col-span-9 > .font-medium > a', manga).first().text().trim() ?? ''
        const subtitle: string = $('.flex.flex-col .flex-row a', manga).first().text().trim() ?? ''

        if(!id || !title) continue
        updateSection_Array.push({
            imageUrl: image,
            title: decodeHTMLEntity(title),
            mangaId: id,
            subtitle: decodeHTMLEntity(subtitle),
            type: "prominentCarouselItem"

        })
    }

    return updateSection_Array
}

export const parsePopularSection = async ($: CheerioAPI): Promise<DiscoverSectionItem[]> => {
    // Popular Today
    const popularSection_Array: DiscoverSectionItem[] = []
    for(const manga of $('a', 'div.flex-wrap.hidden').toArray()) {
        const slug = $(manga).attr('href')?.replace(/\/$/, '')?.split('/').pop() ?? ''
        if(!slug) continue

        const id = await getMangaId(slug)

        const image: string = $('img', manga).first().attr('src') ?? ''
        const title: string = $('span.block.font-bold', manga).first().text().trim() ?? ''
        const subtitle: string = $('span.block.font-bold', manga).first().next().text().trim() ?? ''

        if(!id || !title) continue
        popularSection_Array.push({
            imageUrl: image,
            title: decodeHTMLEntity(title),
            chapterId: decodeHTMLEntity(subtitle),
            mangaId: id,
            type: 'chapterUpdatesCarouselItem'
        })
    }
    return popularSection_Array
}

export const parseViewMore = async ($: CheerioAPI, type: DiscoverSectionType): Promise<DiscoverSectionItem[]> => {
    const manga: DiscoverSectionItem[] = []
    const collectedIds: string[] = []

    for(const item of $('a', 'div.grid.grid-cols-2').toArray()) {
        const slug = $(item).attr('href')?.replace(/\/$/, '')?.split('/').pop() ?? ''
        if(!slug) continue

        const id = await getMangaId(slug)

        const image: string = $('img', item).first().attr('src') ?? ''
        const title: string = $('span.block.font-bold', item).first().text().trim() ?? ''
        const subtitle: string = $('span.block.font-bold', item).first().next().text().trim() ?? ''
        let s: "featuredCarouselItem" | "chapterUpdatesCarouselItem" | "simpleCarouselItem" | "prominentCarouselItem"
        switch(type) {
            case DiscoverSectionType.featured:
                s = "featuredCarouselItem";
                break
            case DiscoverSectionType.chapterUpdates:
                s = "chapterUpdatesCarouselItem"
                break
            case DiscoverSectionType.simpleCarousel:
                s = "simpleCarouselItem"
                break
            case DiscoverSectionType.prominentCarousel:
                s = "prominentCarouselItem"
            case DiscoverSectionType.genres:
                s = "featuredCarouselItem"
                break
        }
        if(!id || !title || collectedIds.includes(id)) continue
        manga.push({
            imageUrl: image,
            title: decodeHTMLEntity(title),
            mangaId: id,
            chapterId: decodeHTMLEntity(subtitle),
            type: s
        })
        collectedIds.push(id)

    }
    return manga
}

export const parseTags = (filters: Filters): TagSection[] => {

    const createTags = (filterItems: any, prefix: string): Tag[] => {
        return filterItems.map((item: { id: any; value: any; name: any }) => ({
            id: `${prefix}:${item.id ?? item.value}`,
            title: item.name
        }))
    }

    const tagSections: TagSection[] = [
        // Tag section for genres
        {
            id: '0',
            title: 'genres',
            tags: createTags(filters.genres, 'genres')
        },
        // Tag section for status
        {
            id: '1',
            title: 'status',
            tags: createTags(filters.statuses, 'status')
        },
        // Tag section for types
        {
            id: '2',
            title: 'type',
            tags: createTags(filters.types, 'type')
        },
        // Tag section for order
        {
            id: '3',
            title: 'order',
            tags: createTags(filters.order.map(order => ({ id: order.value, name: order.name })), 'order')
        }
    ]
    // throw new Error(tagSections.length.toString())
    return tagSections
}

export const parseSearch = async (source: any, $: CheerioAPI): Promise<SearchResultItem[]> => {
    const collectedIds: string[] = []
    const itemArray: SearchResultItem[] = []

    for(const item of $('a', 'div.grid.grid-cols-2').toArray()) {
        const slug = $(item).attr('href')?.replace(/\/$/, '')?.split('/').pop() ?? ''
        if(!slug) continue

        const id = await getMangaId(slug)

        const image: string = $('img', item).first().attr('src') ?? ''
        const title: string = $('span.block.font-bold', item).first().text().trim() ?? ''
        const subtitle: string = $('span.block.font-bold', item).first().next().text().trim() ?? ''




        itemArray.push({
            imageUrl: image,
            title: decodeHTMLEntity(title),
            mangaId: id,
            subtitle: subtitle
        })

        collectedIds.push(id)
    }

    return itemArray
}

export const isLastPage = ($: CheerioAPI): boolean => {
    let isLast = true
    const hasItems = $('a', 'div.grid.grid-cols-2').toArray().length > 0

    if(hasItems) isLast = false
    return isLast
}