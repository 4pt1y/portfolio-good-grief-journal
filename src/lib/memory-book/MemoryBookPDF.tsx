import { Document, Page, Text, View, Image, Font, StyleSheet } from '@react-pdf/renderer'

// Use the PDF spec's built-in Times family — shipped inside pdfkit, so
// no external CDN fetch can break the render. Variants are addressed by
// explicit family name (Times-Roman / Times-Italic / Times-Bold) rather
// than via fontStyle/fontWeight, which is the most reliable pattern with
// react-pdf's built-in fonts.
const SERIF = 'Times-Roman'
const SERIF_ITALIC = 'Times-Italic'

// Don't break long words across lines
Font.registerHyphenationCallback((word) => [word])

const COLORS = {
  cream: '#f7e8f2',
  creamSoft: '#f7e8f2',
  ink: '#3a3462',
  body: '#48598a',
  muted: '#48598a',
  faint: '#b1c2e4',
  accent: '#d69ac6',
  divider: '#b1c2e4',
} as const

const styles = StyleSheet.create({
  // Cover
  coverPage: {
    backgroundColor: '#ffffff',
    padding: 60,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverEyebrow: {
    fontFamily: SERIF_ITALIC,
    color: COLORS.muted,
    fontSize: 11,
    letterSpacing: 6,
    textTransform: 'uppercase',
    marginBottom: 40,
  },
  coverName: {
    fontFamily: SERIF,
    color: COLORS.ink,
    fontSize: 52,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 1.15,
  },
  coverRelationship: {
    fontFamily: SERIF_ITALIC,
    color: COLORS.body,
    fontSize: 15,
    marginBottom: 10,
  },
  coverDates: {
    fontFamily: SERIF,
    color: COLORS.muted,
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 36,
  },
  coverImageWrap: {
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: 'hidden',
    marginTop: 8,
    backgroundColor: COLORS.divider,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  coverDivider: {
    width: 40,
    height: 1,
    backgroundColor: COLORS.faint,
    marginTop: 28,
    marginBottom: 28,
  },

  // Body pages (intro, entries, photos, closing)
  page: {
    backgroundColor: '#ffffff',
    paddingTop: 56,
    paddingBottom: 56,
    paddingHorizontal: 64,
    fontFamily: SERIF,
    color: COLORS.body,
    fontSize: 11,
    lineHeight: 1.65,
  },
  sectionLabel: {
    fontFamily: SERIF_ITALIC,
    color: COLORS.faint,
    fontSize: 9,
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: 36,
  },
  introTitle: {
    fontFamily: SERIF,
    fontSize: 24,
    color: COLORS.ink,
    marginBottom: 28,
    lineHeight: 1.3,
  },
  introText: {
    fontFamily: SERIF,
    fontSize: 12,
    lineHeight: 1.85,
    color: COLORS.body,
    marginBottom: 14,
  },

  // Entry
  entryHeader: {
    marginBottom: 24,
  },
  entryDate: {
    fontFamily: SERIF,
    fontSize: 9,
    color: COLORS.faint,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  entryPrompt: {
    fontFamily: SERIF_ITALIC,
    fontSize: 13,
    color: COLORS.muted,
    lineHeight: 1.45,
  },
  entryParagraph: {
    fontFamily: SERIF,
    fontSize: 11.5,
    color: COLORS.body,
    lineHeight: 1.75,
    marginBottom: 12,
  },
  aiBox: {
    backgroundColor: COLORS.cream,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.accent,
    padding: 18,
    marginTop: 22,
  },
  aiLabel: {
    fontFamily: SERIF_ITALIC,
    fontSize: 9,
    color: COLORS.accent,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  aiParagraph: {
    fontFamily: SERIF,
    fontSize: 10.5,
    color: COLORS.body,
    lineHeight: 1.7,
    marginBottom: 8,
  },

  // Photos
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  photoCard: {
    width: '50%',
    paddingHorizontal: 8,
    marginBottom: 22,
  },
  photoImageWrap: {
    width: '100%',
    height: 200,
    backgroundColor: COLORS.divider,
    overflow: 'hidden',
    borderRadius: 4,
  },
  photoImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  photoCaption: {
    fontFamily: SERIF_ITALIC,
    fontSize: 10,
    color: COLORS.body,
    marginTop: 10,
    lineHeight: 1.45,
  },
  photoDate: {
    fontFamily: SERIF,
    fontSize: 8,
    color: COLORS.faint,
    letterSpacing: 1,
    marginTop: 4,
    textTransform: 'uppercase',
  },

  // Closing
  closingPage: {
    backgroundColor: '#ffffff',
    padding: 60,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closingDivider: {
    width: 32,
    height: 1,
    backgroundColor: COLORS.faint,
    marginBottom: 24,
  },
  closingText: {
    fontFamily: SERIF_ITALIC,
    fontSize: 16,
    color: COLORS.ink,
    textAlign: 'center',
    lineHeight: 1.7,
    maxWidth: 360,
  },
})

export type LovedOne = {
  name: string
  relationship: string | null
  date_of_birth: string | null
  date_of_passing: string | null
  photo_url: string | null
}

export type Entry = {
  id: string
  content: string
  created_at: string
  promptText: string | null
  aiResponse: string | null
}

export type Photo = {
  id: string
  // null when the source image couldn't be fetched/embedded — caller should
  // already pass a data URI here, never a remote URL (react-pdf can't sniff
  // extensions out of signed URLs with query strings)
  url: string | null
  caption: string | null
  taken_at: string | null
}

export type MemoryBookPDFProps = {
  lovedOne: LovedOne
  entries: Entry[]
  photos: Photo[]
  generatedAt: Date
}

function formatLongDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  }).format(new Date(iso))
}

function yearOf(date: string | null): string | null {
  if (!date) return null
  const m = /^(\d{4})/.exec(date)
  return m ? m[1] : null
}

function dateRange(birth: string | null, passing: string | null): string | null {
  const b = yearOf(birth)
  const p = yearOf(passing)
  if (b && p) return `${b} — ${p}`
  if (p) return `In memory · ${p}`
  if (b) return b
  return null
}

function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\n/g, ' ').trim())
    .filter(Boolean)
}

export function MemoryBookPDF({ lovedOne, entries, photos, generatedAt }: MemoryBookPDFProps) {
  const dates = dateRange(lovedOne.date_of_birth, lovedOne.date_of_passing)
  const generatedLong = new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  }).format(generatedAt)

  return (
    <Document
      title={`Memory Book — ${lovedOne.name}`}
      author="The Good Grief Journal"
      subject={`A memory book for ${lovedOne.name}`}
    >
      {/* Cover */}
      <Page size="A4" style={styles.coverPage}>
        <Text style={styles.coverEyebrow}>A Memory Book</Text>
        <Text style={styles.coverName}>{lovedOne.name}</Text>
        {lovedOne.relationship && (
          <Text style={styles.coverRelationship}>{lovedOne.relationship}</Text>
        )}
        {dates && <Text style={styles.coverDates}>{dates}</Text>}
        {lovedOne.photo_url && (
          <View style={styles.coverImageWrap}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={lovedOne.photo_url} style={styles.coverImage} />
          </View>
        )}
        <View style={styles.coverDivider} />
      </Page>

      {/* Introduction */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionLabel}>Introduction</Text>
        <Text style={styles.introTitle}>
          These pages hold the memories of {lovedOne.name}.
        </Text>
        <Text style={styles.introText}>
          What follows is a gathering of moments — the small ones and the large ones, the
          aching ones and the bright ones. They were written one entry at a time, often
          slowly, often through tears, always with care.
        </Text>
        <Text style={styles.introText}>
          Grief is love with nowhere left to go. May these pages be one place it can rest
          for a while.
        </Text>
        <Text style={[styles.introText, { color: COLORS.faint, marginTop: 24, fontSize: 10 }]}>
          Compiled on {generatedLong}.
        </Text>
      </Page>

      {/* Entries — one page per entry; long entries auto-wrap to additional pages */}
      {entries.map((entry, i) => (
        <Page key={entry.id} size="A4" style={styles.page}>
          <Text style={styles.sectionLabel}>
            Entry {i + 1} of {entries.length}
          </Text>
          <View style={styles.entryHeader}>
            <Text style={styles.entryDate}>{formatLongDate(entry.created_at)}</Text>
            {entry.promptText && (
              <Text style={styles.entryPrompt}>“{entry.promptText}”</Text>
            )}
          </View>
          {paragraphs(entry.content).map((p, idx) => (
            <Text key={idx} style={styles.entryParagraph}>{p}</Text>
          ))}
          {entry.aiResponse && (
            <View style={styles.aiBox} wrap={false}>
              <Text style={styles.aiLabel}>A gentle reflection</Text>
              {paragraphs(entry.aiResponse).map((p, idx) => (
                <Text key={idx} style={styles.aiParagraph}>{p}</Text>
              ))}
            </View>
          )}
        </Page>
      ))}

      {/* Photos — skip any whose image we couldn't embed rather than crashing the render */}
      {(() => {
        const renderable = photos.filter((p) => p.url !== null)
        if (renderable.length === 0) return null
        return (
          <Page size="A4" style={styles.page}>
            <Text style={styles.sectionLabel}>Photographs</Text>
            <View style={styles.photoGrid}>
              {renderable.map((p) => (
                <View key={p.id} style={styles.photoCard} wrap={false}>
                  <View style={styles.photoImageWrap}>
                    {/* eslint-disable-next-line jsx-a11y/alt-text */}
                    <Image src={p.url as string} style={styles.photoImage} />
                  </View>
                  {p.caption && <Text style={styles.photoCaption}>{p.caption}</Text>}
                  {p.taken_at && (
                    <Text style={styles.photoDate}>{formatLongDate(p.taken_at)}</Text>
                  )}
                </View>
              ))}
            </View>
          </Page>
        )
      })()}

      {/* Closing */}
      <Page size="A4" style={styles.closingPage}>
        <View style={styles.closingDivider} />
        <Text style={styles.closingText}>
          May these memories continue to bring you peace and connection.{'\n'}
          With love.
        </Text>
        <View style={[styles.closingDivider, { marginTop: 24, marginBottom: 0 }]} />
      </Page>
    </Document>
  )
}
