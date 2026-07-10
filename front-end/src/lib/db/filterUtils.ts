export const normalizeTags = (tags: string[] = []) =>
  Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  )

export const matchesTags = (recordTags: string[], selectedTags: string[] = []) =>
  selectedTags.length === 0 || selectedTags.every((tag) => recordTags.includes(tag))

export const sortTags = (tags: string[]) => tags.sort((a, b) => a.localeCompare(b))
