import {
    SearchFilter,
    SearchQuery,
    Tag
} from '@paperback/types'


export function getIncludedTagBySection(section: string, tags: any[]): any {
    console.log("in include tag func" + section)
    return (tags?.find((x: string) => x.startsWith(`${section}:`))?.id.replace(`${section}:`, '') ?? '').replace(' ', '+')
}

export function getFilterTagsBySection(section: string, tags: any[]): string[] {
    console.log("Its getting here")
    return tags?.filter((x: string) => x.startsWith(`${section}:`)).map((x: string) => {
        return x.replace(`${section}:`, '')
    })
}

export class URLBuilder {
    parameters: Record<string, any | any[]> = {}
    pathComponents: string[] = []
    baseUrl: string

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl.replace(/(^\/)?(?=.*)(\/$)?/gim, '')
    }

    addPathComponent(component: string): URLBuilder {
        this.pathComponents.push(component.replace(/(^\/)?(?=.*)(\/$)?/gim, ''))
        return this
    }

    addQueryParameter(key: string, value: any | any[]): URLBuilder {
        if(Array.isArray(value) && !value.length) {
            return this
        }

        const array = (this.parameters[key] as any[])
        if(array?.length) {
            array.push(value)
        } else {
            this.parameters[key] = value
        }
        return this
    }

    buildUrl({ addTrailingSlash, includeUndefinedParameters } = { addTrailingSlash: false, includeUndefinedParameters: false }): string {
        let finalUrl = this.baseUrl + '/'

        finalUrl += this.pathComponents.join('/')
        finalUrl += addTrailingSlash
            ? '/'
            : ''
        finalUrl += Object.values(this.parameters).length > 0
            ? '?'
            : ''
        finalUrl += Object.entries(this.parameters).map(entry => {
            if(!entry[1] && !includeUndefinedParameters) {
                return undefined
            }

            if(Array.isArray(entry[1]) && entry[1].length) {
                return `${entry[0]}=${entry[1].map(value => value || includeUndefinedParameters
                    ? value
                    : undefined)
                    .filter(x => x !== undefined)
                    .join(',')}`
            }

            if(typeof entry[1] === 'object') {
                return Object.keys(entry[1]).map(key => `${entry[0]}[${key}]=${entry[1][key]}`)
                    .join('&')
            }

            return `${entry[0]}=${entry[1]}`
        }).filter(x => x !== undefined).join('&')

        return finalUrl
    }
}