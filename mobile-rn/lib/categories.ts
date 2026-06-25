export interface SubCategory {
    id: string
    label: string
    dbCategories: string[]
    available: boolean
}

export interface Category {
    id: string
    label: string
    subcategories: SubCategory[]
}

export const CATEGORIES: Category[] = [
    {
        id: "sports",
        label: "Sports",
        subcategories: [
            { id: "football", label: "Football", dbCategories: ["Footballer"], available: true },
            { id: "basketball", label: "Basketball", dbCategories: [], available: false },
            { id: "golf", label: "Golf", dbCategories: [], available: false },
            { id: "tennis", label: "Tennis", dbCategories: [], available: false },
            { id: "cricket", label: "Cricket", dbCategories: [], available: false },
        ],
    },
    {
        id: "tv_film",
        label: "TV & Film",
        subcategories: [
            { id: "actors", label: "Actors & Actresses", dbCategories: ["Actor", "Actress"], available: true },
            { id: "directors", label: "Directors", dbCategories: [], available: false },
            { id: "reality_tv", label: "Reality TV", dbCategories: [], available: false },
        ],
    },
    {
        id: "music",
        label: "Music",
        subcategories: [
            { id: "singers", label: "Singers", dbCategories: ["Musician"], available: true },
            { id: "rappers", label: "Rappers", dbCategories: ["Musician"], available: true },
            { id: "djs", label: "DJs", dbCategories: ["Musician"], available: true },
            { id: "instrumentalists", label: "Instrumentalists", dbCategories: ["Musician"], available: true },
        ],
    },
]

export function getDbCategories(selectedIds: string[]): string[] {
    if (selectedIds.length === 0) return []
    const db = new Set<string>()
    for (const cat of CATEGORIES) {
        for (const sub of cat.subcategories) {
            if (selectedIds.includes(sub.id)) {
                sub.dbCategories.forEach((c) => db.add(c))
            }
        }
    }
    return Array.from(db)
}

export function getCategoryLabel(selectedIds: string[]): string {
    if (selectedIds.length === 0) return "All categories"
    const names = CATEGORIES.flatMap((c) =>
        c.subcategories.filter((s) => selectedIds.includes(s.id)).map((s) => s.label)
    )
    if (names.length === 1) return names[0]
    if (names.length <= 3) return names.join(", ")
    return `${names.length} selected`
}
