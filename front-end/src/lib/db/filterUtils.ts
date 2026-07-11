export const normalizeTags = (tags: string[] = []) =>
  Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  )

export const matchesTags = (recordTags: string[], selectedTags: string[] = []) =>
  selectedTags.length === 0 || selectedTags.every((tag) => recordTags.includes(tag))

export const normalizeSearchQuery = (query = '') => query.trim().toLowerCase()

export const matchesSearchText = (query: string | undefined, values: string[]) => {
  const normalizedQuery = normalizeSearchQuery(query)
  if (!normalizedQuery) return true

  return values.some((value) => value.toLowerCase().includes(normalizedQuery))
}

export const sortTags = (tags: string[]) => tags.sort((a, b) => a.localeCompare(b))
