import { v4 as uuidv4 } from 'uuid'

const ZODIAC_SIGNS = [
    'Aries','Taurus','Gemini','Cancer','Leo','Virgo',
    'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces',
]

const DIFFICULTY_CONFIG: Record<string, { pctMin: number; pctMax: number; spread: number }> = {
    easy:   { pctMin: 0.67, pctMax: 1.01, spread: 5 },
    medium: { pctMin: 0.34, pctMax: 0.67, spread: 3 },
    hard:   { pctMin: 0.00, pctMax: 0.34, spread: 1 },
}

const ESCALATING_BATCHES = [
    { count: 3, key: 'easy' },
    { count: 4, key: 'medium' },
    { count: 3, key: 'hard' },
]

interface BundlePerson {
    id: string
    full_name: string
    date_of_birth: string
    star_sign: string
    primary_category: string
    image_url: string
    hints_easy: string[]
    pop_pct: number
}

interface BundleSingleTemplate {
    id: string
    mode: string
    person_id: string
}

interface BundlePairTemplate {
    id: string
    mode: string
    person_id_a: string
    person_id_b: string
}

interface Bundle {
    version: string
    persons: BundlePerson[]
    single_templates: BundleSingleTemplate[]
    pair_templates: BundlePairTemplate[]
}

let _bundle: Bundle | null = null

async function getBundle(): Promise<Bundle> {
    if (_bundle) return _bundle
    const res = await fetch('/offline-bundle.json')
    _bundle = await res.json()
    return _bundle!
}

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]]
    }
    return a
}

function sample<T>(arr: T[], n: number): T[] {
    return shuffle(arr).slice(0, n)
}

function calcAge(dob: string): number {
    const d = new Date(dob)
    const today = new Date()
    let age = today.getFullYear() - d.getFullYear()
    if (today.getMonth() < d.getMonth() || (today.getMonth() === d.getMonth() && today.getDate() < d.getDate())) {
        age--
    }
    return age
}

function buildQuestion(
    template: BundleSingleTemplate,
    person: BundlePerson,
    mode: string,
    spread: number,
): object {
    const base = {
        id: template.id,
        mode,
        difficulty: 3,
        hints: person.hints_easy || [],
        person_id: person.id,
        person_name: person.full_name,
        person_image_url: person.image_url,
    }

    if (mode === 'REVERSE_SIGN') {
        const correct = person.star_sign
        const decoys = sample(ZODIAC_SIGNS.filter(s => s !== correct), 8)
        const options = shuffle([...decoys, correct])
        return { ...base, options, correct_answer: { sign: correct } }
    }

    if (mode === 'REVERSE_DOB') {
        const correct = new Date(person.date_of_birth).getFullYear()
        const offsets = [-3,-2,-1,1,2,3,4,5]
        const decoys = sample(offsets, 8).map(o => correct + o)
        const options = shuffle([...decoys, correct])
        return { ...base, options, correct_answer: { year: correct } }
    }

    // AGE_GUESS
    const correct = calcAge(person.date_of_birth)
    const pool = new Set<number>()
    let s = spread
    while (pool.size < 3) {
        for (let d = -s; d <= s; d++) {
            const v = correct + d
            if (d !== 0 && v >= 16 && v <= 100) pool.add(v)
        }
        s++
    }
    const options = shuffle([...sample([...pool], 3), correct])
    return { ...base, options, correct_answer: { age: correct } }
}

function buildWhoOlderQuestion(
    template: BundlePairTemplate,
    personA: BundlePerson,
    personB: BundlePerson,
): object {
    return {
        id: template.id,
        mode: 'WHO_OLDER',
        difficulty: 3,
        hints: [],
        person_id_a: personA.id,
        person_id_b: personB.id,
        person_name_a: personA.full_name,
        person_name_b: personB.full_name,
        person_image_url_a: personA.image_url,
        person_image_url_b: personB.image_url,
        correct_answer: {
            choice: personA.date_of_birth < personB.date_of_birth ? 'A' : 'B',
            year_a: new Date(personA.date_of_birth).getFullYear(),
            year_b: new Date(personB.date_of_birth).getFullYear(),
        },
    }
}

function filterByCategory(persons: BundlePerson[], categories: string[]): BundlePerson[] {
    if (!categories || categories.length === 0) return persons
    return persons.filter(p => categories.includes(p.primary_category))
}

export async function offlineStartSession(payload: {
    mode: string
    categories?: string[]
    difficulty?: string
}): Promise<{ id: string; mode: string; questions: object[] }> {
    const bundle = await getBundle()
    const personMap = new Map(bundle.persons.map(p => [p.id, p]))

    const diff = payload.difficulty || 'easy'
    const NUM = 10

    let questions: object[] = []

    if (payload.mode === 'WHO_OLDER') {
        let pairs = bundle.pair_templates
        if (payload.categories?.length) {
            pairs = pairs.filter(t => {
                const a = personMap.get(t.person_id_a)
                const b = personMap.get(t.person_id_b)
                return a && b &&
                    payload.categories!.includes(a.primary_category) &&
                    payload.categories!.includes(b.primary_category)
            })
        }

        const filterPct = (pctMin: number, pctMax: number) =>
            pairs.filter(t => {
                const a = personMap.get(t.person_id_a)
                const b = personMap.get(t.person_id_b)
                return a && b && a.pop_pct >= pctMin && a.pop_pct < pctMax &&
                    b.pop_pct >= pctMin && b.pop_pct < pctMax
            })

        const pickPairs = (cfg: typeof DIFFICULTY_CONFIG[string], count: number) =>
            sample(filterPct(cfg.pctMin, cfg.pctMax), count)
                .map(t => buildWhoOlderQuestion(t, personMap.get(t.person_id_a)!, personMap.get(t.person_id_b)!))

        if (diff === 'escalating') {
            for (const batch of ESCALATING_BATCHES) {
                questions.push(...pickPairs(DIFFICULTY_CONFIG[batch.key], batch.count))
            }
        } else {
            questions = pickPairs(DIFFICULTY_CONFIG[diff] ?? DIFFICULTY_CONFIG.easy, NUM)
        }
    } else {
        let templates = bundle.single_templates.filter(t => t.mode === payload.mode)

        if (payload.categories?.length) {
            templates = templates.filter(t => {
                const p = personMap.get(t.person_id)
                return p && payload.categories!.includes(p.primary_category)
            })
        }

        const filterPct = (pctMin: number, pctMax: number) =>
            templates.filter(t => {
                const p = personMap.get(t.person_id)
                return p && p.pop_pct >= pctMin && p.pop_pct < pctMax
            })

        const pick = (cfg: typeof DIFFICULTY_CONFIG[string], count: number, spread: number) =>
            sample(filterPct(cfg.pctMin, cfg.pctMax), count)
                .map(t => buildQuestion(t, personMap.get(t.person_id)!, payload.mode, spread))

        if (diff === 'escalating') {
            for (const batch of ESCALATING_BATCHES) {
                const cfg = DIFFICULTY_CONFIG[batch.key]
                questions.push(...pick(cfg, batch.count, cfg.spread))
            }
        } else {
            const cfg = DIFFICULTY_CONFIG[diff] ?? DIFFICULTY_CONFIG.easy
            questions = pick(cfg, NUM, cfg.spread)
        }
    }

    return { id: `offline-${uuidv4()}`, mode: payload.mode, questions }
}

export function offlineSubmitAnswer(payload: {
    question: any
    user_answer: any
    mode: string
}): { is_correct: boolean; score_awarded: number; correct_answer: any } {
    const { question, user_answer, mode } = payload
    const correct = question.correct_answer

    let is_correct = false
    let score_awarded = 0

    if (mode === 'AGE_GUESS') {
        const diff = Math.abs((user_answer.age ?? 0) - (correct.age ?? 0))
        if (diff === 0) { is_correct = true; score_awarded = 100 }
        else if (diff <= 1) { is_correct = true; score_awarded = 80 }
        else if (diff <= 2) { score_awarded = 60 }
        else if (diff <= 3) { score_awarded = 40 }
        else if (diff <= 5) { score_awarded = 20 }
    } else if (mode === 'WHO_OLDER') {
        is_correct = user_answer.choice === correct.choice
        score_awarded = is_correct ? 100 : 0
    } else if (mode === 'REVERSE_SIGN') {
        is_correct = user_answer.sign === correct.sign
        score_awarded = is_correct ? 50 : 0
    } else if (mode === 'REVERSE_DOB') {
        is_correct = String(user_answer.year) === String(correct.year)
        score_awarded = is_correct ? 50 : 0
    }

    return { is_correct, score_awarded, correct_answer: correct }
}

export function offlineEndSession(questions: any[], answers: any[]): {
    totalScore: number; questionsCount: number; correctCount: number
    bestStreak: number; accuracy: number; lifetimeScore: number; globalRank: number
} {
    const totalScore = answers.reduce((s, a) => s + (a.score_awarded ?? 0), 0)
    const correctCount = answers.filter(a => a.is_correct).length
    const questionsCount = questions.length

    let bestStreak = 0, cur = 0
    for (const a of answers) {
        if (a.is_correct) { cur++; bestStreak = Math.max(bestStreak, cur) } else { cur = 0 }
    }

    return {
        totalScore,
        questionsCount,
        correctCount,
        bestStreak,
        accuracy: questionsCount > 0 ? Math.round(correctCount / questionsCount * 100) : 0,
        lifetimeScore: totalScore,
        globalRank: 0,
    }
}
