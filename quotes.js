// Curated Chinese wisdom quotes — classics, proverbs, philosophy.
// Each: zh (汉字), pinyin (romanization), en (translation), author/source.
export const QUOTES = [
  {
    zh: "千里之行，始于足下。",
    pinyin: "Qiān lǐ zhī xíng, shǐ yú zú xià.",
    en: "A journey of a thousand miles begins with a single step.",
    author: "Lao Tzu · 老子"
  },
  {
    zh: "学而时习之，不亦说乎？",
    pinyin: "Xué ér shí xí zhī, bù yì yuè hū?",
    en: "Is it not a pleasure to learn and to practice what you have learned?",
    author: "Confucius · 孔子"
  },
  {
    zh: "知之者不如好之者，好之者不如乐之者。",
    pinyin: "Zhī zhī zhě bù rú hào zhī zhě, hào zhī zhě bù rú lè zhī zhě.",
    en: "Those who know are not equal to those who love it; those who love are not equal to those who delight in it.",
    author: "Confucius · 孔子"
  },
  {
    zh: "天行健，君子以自强不息。",
    pinyin: "Tiān xíng jiàn, jūnzǐ yǐ zì qiáng bù xī.",
    en: "As heaven keeps vigour through movement, the noble person strives ceaselessly to strengthen themselves.",
    author: "I Ching · 易经"
  },
  {
    zh: "上善若水。",
    pinyin: "Shàng shàn ruò shuǐ.",
    en: "The highest good is like water — it benefits all things and contends with none.",
    author: "Lao Tzu · 老子"
  },
  {
    zh: "宁静致远。",
    pinyin: "Níng jìng zhì yuǎn.",
    en: "Through tranquility, one reaches far.",
    author: "Zhuge Liang · 诸葛亮"
  },
  {
    zh: "塞翁失马，焉知非福。",
    pinyin: "Sài wēng shī mǎ, yān zhī fēi fú.",
    en: "The old man lost his horse — who knows it's not a blessing in disguise?",
    author: "Huainanzi · 淮南子"
  },
  {
    zh: "工欲善其事，必先利其器。",
    pinyin: "Gōng yù shàn qí shì, bì xiān lì qí qì.",
    en: "To do a job well, one must first sharpen their tools.",
    author: "Confucius · 孔子"
  },
  {
    zh: "静水流深。",
    pinyin: "Jìng shuǐ liú shēn.",
    en: "Still waters run deep.",
    author: "Chinese Proverb"
  },
  {
    zh: "不积跬步，无以至千里。",
    pinyin: "Bù jī kuǐ bù, wú yǐ zhì qiān lǐ.",
    en: "Without accumulating small steps, one cannot travel a thousand miles.",
    author: "Xunzi · 荀子"
  },
  {
    zh: "人无远虑，必有近忧。",
    pinyin: "Rén wú yuǎn lǜ, bì yǒu jìn yōu.",
    en: "If one does not plan for the long term, troubles will surely arise nearby.",
    author: "Confucius · 孔子"
  },
  {
    zh: "海纳百川，有容乃大。",
    pinyin: "Hǎi nà bǎi chuān, yǒu róng nǎi dà.",
    en: "The sea accepts a hundred rivers — greatness lies in capacity.",
    author: "Lin Zexu · 林则徐"
  },
  {
    zh: "知己知彼，百战不殆。",
    pinyin: "Zhī jǐ zhī bǐ, bǎi zhàn bù dài.",
    en: "Know yourself and know your enemy, and you will never be defeated.",
    author: "Sun Tzu · 孙子"
  },
  {
    zh: "道法自然。",
    pinyin: "Dào fǎ zì rán.",
    en: "The Tao follows nature.",
    author: "Lao Tzu · 老子"
  },
  {
    zh: "己所不欲，勿施于人。",
    pinyin: "Jǐ suǒ bù yù, wù shī yú rén.",
    en: "Do not do unto others what you do not want done unto yourself.",
    author: "Confucius · 孔子"
  },
  {
    zh: "失败是成功之母。",
    pinyin: "Shī bài shì chéng gōng zhī mǔ.",
    en: "Failure is the mother of success.",
    author: "Chinese Proverb"
  },
  {
    zh: "三人行，必有我师焉。",
    pinyin: "Sān rén xíng, bì yǒu wǒ shī yān.",
    en: "Among any three people walking, I will find a teacher.",
    author: "Confucius · 孔子"
  },
  {
    zh: "祸兮福所倚，福兮祸所伏。",
    pinyin: "Huò xī fú suǒ yǐ, fú xī huò suǒ fú.",
    en: "Misfortune is what fortune leans on; fortune is where misfortune hides.",
    author: "Lao Tzu · 老子"
  },
  {
    zh: "百闻不如一见。",
    pinyin: "Bǎi wén bù rú yī jiàn.",
    en: "Hearing a hundred times is not as good as seeing once.",
    author: "Book of Han · 汉书"
  },
  {
    zh: "玉不琢，不成器。",
    pinyin: "Yù bù zhuó, bù chéng qì.",
    en: "Jade uncarved becomes no vessel — without effort, no excellence.",
    author: "Book of Rites · 礼记"
  },
  {
    zh: "山高月小，水落石出。",
    pinyin: "Shān gāo yuè xiǎo, shuǐ luò shí chū.",
    en: "When the mountain is tall the moon seems small; when the water recedes the stones appear — truth surfaces in time.",
    author: "Su Shi · 苏轼"
  },
  {
    zh: "心静自然凉。",
    pinyin: "Xīn jìng zì rán liáng.",
    en: "When the heart is calm, coolness comes of itself.",
    author: "Bai Juyi · 白居易"
  }
];

export function pickRandom(prev) {
  if (QUOTES.length <= 1) return QUOTES[0];
  let q;
  do {
    q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  } while (q === prev);
  return q;
}
