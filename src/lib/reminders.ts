import type { Lang } from "./types";

export interface Reminder {
  text: string;
  ref: string;
}

/**
 * Short reminders on the virtue of dhikr. Arabic Qur'an text is Tanzil's quran-simple
 * (via api.alquran.cloud), which may only be copied verbatim: never edit these strings,
 * not even to add verse markers. See CREDITS.md. The hadith is al-Bukhari 6407 as in
 * fawazahmed0/hadith-api. English is a translation of meaning.
 */
const REMINDERS: Record<Lang, Reminder>[] = [
  {
    en: { text: "Verily, in the remembrance of Allah do hearts find rest.", ref: "Qur'an 13:28" },
    ar: { text: "أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ", ref: "الرعد: 28" },
  },
  {
    en: { text: "Remember Me; I will remember you.", ref: "Qur'an 2:152" },
    ar: { text: "فَاذْكُرُونِي أَذْكُرْكُمْ", ref: "البقرة: 152" },
  },
  {
    en: {
      text: "O you who have believed, remember Allah with much remembrance, and exalt Him morning and evening.",
      ref: "Qur'an 33:41–42",
    },
    ar: {
      text: "يَا أَيُّهَا الَّذِينَ آمَنُوا اذْكُرُوا اللَّهَ ذِكْرًا كَثِيرًا وَسَبِّحُوهُ بُكْرَةً وَأَصِيلًا",
      ref: "الأحزاب: 41–42",
    },
  },
  {
    en: { text: "So exalt Allah when you reach the evening and when you reach the morning.", ref: "Qur'an 30:17" },
    ar: { text: "فَسُبْحَانَ اللَّهِ حِينَ تُمْسُونَ وَحِينَ تُصْبِحُونَ", ref: "الروم: 17" },
  },
  {
    en: {
      text: "The example of the one who remembers his Lord and the one who does not is like the living and the dead.",
      ref: "al-Bukhari 6407",
    },
    ar: { text: "مَثَلُ الَّذِي يَذْكُرُ رَبَّهُ وَالَّذِي لاَ يَذْكُرُ مَثَلُ الْحَىِّ وَالْمَيِّتِ", ref: "رواه البخاري (6407)" },
  },
];

export function randomReminder(lang: Lang): Reminder {
  const pick = REMINDERS[Math.floor(Math.random() * REMINDERS.length)] ?? REMINDERS[0]!;
  return pick[lang];
}
