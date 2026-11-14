// India-time event selection. Moving dates are entered only after confirmation.
const yearly = {
  "01-01": { id: "new-year", title: "Happy New Year", message: "May this new year bring health, hope and kindness to every family.", symbol: "✦" },
  "01-26": { id: "republic-day", title: "Happy Republic Day", message: "Celebrating the values of dignity, compassion and service to others.", symbol: "🇮🇳" },
  "08-15": { id: "independence-day", title: "Happy Independence Day", message: "Together, we can turn the spirit of service into a brighter future.", symbol: "🇮🇳" },
  "10-02": { id: "gandhi-jayanti", title: "Gandhi Jayanti", message: "Honouring a legacy of service, nonviolence and care for all.", symbol: "✦" },
  "11-14": { id: "childrens-day", title: "Happy Children's Day", message: "Wishing every child a future filled with health, dignity, joy and hope.", symbol: "♡" },
  "12-25": { id: "christmas", title: "Merry Christmas", message: "Wishing you and your loved ones a season of peace, kindness and hope.", symbol: "✦" },
};

// Dates for movable celebrations are maintained deliberately rather than
// guessing from the lunar calendar. Check official national/state notices
// before extending the calendar or changing a festival date.
const byDate = {
  "2026-03-04": { id: "holi", title: "Happy Holi", message: "May this festival of colours fill every life with joy, care and hope.", symbol: "✿" },
  "2026-09-04": { id: "janmashtami", title: "Happy Janmashtami", message: "Sending warm wishes of peace, compassion and happiness.", symbol: "✦" },
  "2026-10-20": { id: "dussehra", title: "Happy Dussehra", message: "Wishing you courage, goodness and new beginnings.", symbol: "✦" },
  "2026-11-08": { id: "diwali", title: "Happy Diwali", message: "May the festival of lights bring warmth, compassion and hope to every home.", symbol: "✦" },
  "2026-11-24": { id: "guru-nanak-jayanti", title: "Guru Nanak Jayanti", message: "Warm wishes on this day of service, equality and compassion.", symbol: "✦" },
  "2027-03-23": { id: "holi", title: "Happy Holi", message: "May this festival of colours fill every life with joy, care and hope.", symbol: "✿" },
  "2027-08-25": { id: "janmashtami", title: "Happy Janmashtami", message: "Sending warm wishes of peace, compassion and happiness.", symbol: "✦" },
  "2027-10-09": { id: "dussehra", title: "Happy Dussehra", message: "Wishing you courage, goodness and new beginnings.", symbol: "✦" },
  "2027-10-29": { id: "diwali", title: "Happy Diwali", message: "May the festival of lights bring warmth, compassion and hope to every home.", symbol: "✦" },
  "2027-11-14": { id: "childrens-day-guru-nanak", title: "Children's Day & Guru Nanak Jayanti", message: "Celebrating children, kindness, community and the spirit of service.", symbol: "♡" },
};

export function indiaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const part = (name) => parts.find((p) => p.type === name)?.value || "";
  return part("year") + "-" + part("month") + "-" + part("day");
}

export function occasionOn(date = new Date()) {
  const key = indiaDateKey(date);
  const occasion = byDate[key] || yearly[key.slice(5)];
  return occasion ? { ...occasion, date: key } : null;
}
