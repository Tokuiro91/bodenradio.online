export interface Artist {
  id: number
  name: string
  location: string
  show: string
  image: string
  audioUrl?: string
  duration: string
  description: string
  dayIndex: number
  orderInDay: number
  startTime: string
  endTime: string
  instagramUrl?: string
  soundcloudUrl?: string
  bandcampUrl?: string
  genres?: string[]
  lat?: number
  lng?: number
  // Advertisement fields
  type?: 'artist' | 'ad'
  redirectUrl?: string
  campaignStart?: string
  campaignEnd?: string
  isLottie?: boolean
  dbId?: string
}

const ROLL_WINDOW_PAST_MS = 8 * 60 * 60 * 1000   // 8 hours
const ROLL_WINDOW_FUTURE_MS = 16 * 60 * 60 * 1000 // 16 hours

export function isArtistInRollingWindow(artist: Artist, nowMs: number): boolean {
  if (artist.type === 'ad') return true // Ads usually have their own campaign logic

  const startMs = new Date(artist.startTime).getTime()
  const endMs = new Date(artist.endTime).getTime()

  // Card is shown if it ended less than 8h ago AND starts less than 16h from now
  return endMs > nowMs - ROLL_WINDOW_PAST_MS && startMs < nowMs + ROLL_WINDOW_FUTURE_MS
}

const artistNames = [
  "JULIA GOVOR", "RE:BOOT", "KAGO DO", "KIRILL MATVEEV", "KEVIN REIS",
  "VSEVOLOD", "ANNA LEAH", "DMITRY MOLOSH", "SOLAR FIELDS", "NICK WARREN",
  "SASHA KHIZHNYAKOV", "MARK KNIGHT", "MISS MONIQUE", "HERNAN CATTANEO",
  "ARMIN VAN DER", "BORIS BREJCHA", "NINA KRAVIZ", "AMELIE LENS",
  "CHARLOTTE DE WITTE", "ADAM BEYER", "TALE OF US", "SOLOMUN", "ARTBAT",
  "MACEO PLEX", "RICHIE HAWTIN", "CARL COX", "DEBORAH DE LUCA",
  "PEGGY GOU", "FISHER", "JAMIE JONES",
]

const locations = [
  "Нью-Йорк, США", "Белгород, Россия", "Пхукет, Таиланд",
  "Санкт-Петербург, Россия", "Лондон, Великобритания",
  "Москва, Россия", "Берлин, Германия", "Минск, Беларусь",
  "Гётеборг, Швеция", "Бристоль, Великобритания",
  "Киев, Украина", "Лондон, Великобритания", "Киев, Украина",
  "Буэнос-Айрес, Аргентина", "Лейден, Нидерланды",
  "Мангейм, Германия", "Иркутск, Россия", "Антверпен, Бельгия",
  "Гент, Бельгия", "Стокгольм, Швеция", "Милан, Италия",
  "Гамбург, Германия", "Киев, Украина", "Барселона, Испания",
  "Виндзор, Великобритания", "Мельбурн, Австралия",
  "Неаполь, Италия", "Сеул, Южная Корея",
  "Каирнс, Австралия", "Бристоль, Великобритания",
]

const shows = [
  "PODCAST #1", "OBVIOUS - AN INCREDIBLE #03", "NIGHT PODCAST 05",
  "AMBIANCE", "HDNSM SPECIAL #3", "GRIBOEDOV SET",
  "DEEP SESSIONS 12", "SOUND AVENUE 044", "AMBIENT MIX 07",
  "BALANCE 018", "AFTERHOURS 22", "TOOLROOM RADIO 15",
  "MISS MONIQUE LIVE", "SUNSETSTRIP 88", "ASOT EPISODE 1100",
  "FCKNG SERIOUS MIX", "TRIP MIX 33", "EXHALE 049",
  "KNTXT PODCAST 17", "DRUMCODE LIVE 544",
  "AFTERLIFE VOYAGE 22", "SOLOMUN +1 PODCAST",
  "ARTBAT UPPERGROUND", "MOSAIC MIX 06",
  "CLOSE COMBINED", "GLOBAL 770", "SOLAMENTE SET",
  "PEGGY GOU RADIO 05", "CATCH & RELEASE 12",
  "PARADISE RADIO 08",
]

const durations = [
  "01:30:00", "02:00:00", "01:45:00", "01:15:00", "02:30:00",
  "01:00:00", "01:20:00", "02:15:00", "01:50:00", "02:00:00",
  "01:30:00", "01:45:00", "02:00:00", "02:30:00", "01:15:00",
  "01:40:00", "02:10:00", "01:55:00", "01:30:00", "02:00:00",
  "01:25:00", "02:05:00", "01:35:00", "01:50:00", "02:20:00",
  "01:45:00", "01:30:00", "02:00:00", "01:40:00", "01:55:00",
]

const descriptions: string[] = [/* твои описания без изменений */]

function parseDurationToMs(duration: string) {
  const [h, m, s] = duration.split(":").map(Number)
  return (h * 3600 + m * 60 + s) * 1000
}

export function generateArtists(): Artist[] {
  const artists: Artist[] = []

    const now = new Date()
    const baseDates = [
      new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0, 0).toISOString(),
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 14, 0, 0).toISOString(),
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 14, 0, 0).toISOString(),
    ]

  for (let i = 0; i < 30; i++) {
    const dayIndex = Math.floor(i / 10)
    const orderInDay = i % 10

    const baseStart = new Date(baseDates[dayIndex])

    let offsetMs = 0
    for (let j = dayIndex * 10; j < i; j++) {
      offsetMs += parseDurationToMs(durations[j])
    }

    const startDate = new Date(baseStart.getTime() + offsetMs)
    const endDate = new Date(
      startDate.getTime() + parseDurationToMs(durations[i])
    )

    artists.push({
      id: i,
      name: artistNames[i],
      location: locations[i],
      show: shows[i],
      image: `/artists/artist-${(i % 10) + 1}.jpg`,
      duration: durations[i],
      description: descriptions[i],
      dayIndex,
      orderInDay,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
    })
  }

  return artists
}

export const DAY_LABELS = [
  new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }).toUpperCase(),
  new Date(Date.now() + 86400000).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }).toUpperCase(),
  new Date(Date.now() + 172800000).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }).toUpperCase(),
]