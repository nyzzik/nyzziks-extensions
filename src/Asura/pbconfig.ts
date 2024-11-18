import { ContentRating, SourceInfo, SourceIntents } from "@paperback/types"
import { getExportVersion } from "./AsuraConfig"

export default {
    version: getExportVersion('0.0.0'),
    name: 'AsuraScans',
    icon: 'icon.png',
    developers: [
        {
            name: "nyzzik",
            github: "https://github.com/nyzzik"
        }
    ],
    description: 'AsuraScans source',
    contentRating: ContentRating.MATURE,
    badges: [
        {
            label: "18+",
            textColor: "#000000",
            backgroundColor: "#DD2222"
        },
        {
            label: "Buggy",
            textColor: "#000000",
            backgroundColor: "#FF00FF"
        },
    ],
    capabilities: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS | SourceIntents.SETTINGS_UI | SourceIntents.MANGA_TRACKING | SourceIntents.MANGA_SEARCH
} satisfies SourceInfo