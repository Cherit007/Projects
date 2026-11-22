/**
 * SSC CGL Percentage pack (English stems + options + answer keys).
 * Solutions / explanations intentionally omitted for now.
 */

import type { AnswerKey } from '../utils/questionBank'

export const PERCENTAGE_PACK_TOPIC_ID = 'qa-percent-pl'
export const PERCENTAGE_PACK_ID = 'pct-champion-ssc-1-53'

export type PercentagePackItem = {
  number: number
  stem: string
  options: Record<'A' | 'B' | 'C' | 'D', string>
  answerKey: AnswerKey
  /** Exam tag when known */
  sourceTag?: string
}

const A = 'A' as const
const B = 'B' as const
const C = 'C' as const
const D = 'D' as const

function q(
  number: number,
  stem: string,
  options: [string, string, string, string],
  answer: 0 | 1 | 2 | 3,
  sourceTag?: string,
): PercentagePackItem {
  const keys = [A, B, C, D] as const
  return {
    number,
    stem,
    options: {
      A: options[0],
      B: options[1],
      C: options[2],
      D: options[3],
    },
    answerKey: keys[answer],
    sourceTag,
  }
}

/** Answer letters for Q1–53 (verified against the printed key + independent solve). */
export const PERCENTAGE_ANSWER_KEY: Record<number, AnswerKey> = {
  1: C,
  2: D,
  3: B,
  4: C,
  5: B,
  6: D,
  7: C,
  8: B,
  9: C,
  10: A,
  11: D,
  12: B,
  13: C,
  14: C,
  15: A,
  16: B,
  17: B,
  18: C,
  19: C,
  20: C,
  21: C,
  22: B,
  23: C,
  24: A,
  25: C,
  26: C,
  27: C,
  28: B,
  29: B,
  30: A,
  31: A,
  32: C,
  33: C,
  34: C,
  35: C,
  36: B,
  37: B,
  38: C,
  39: B,
  40: A,
  41: C,
  42: B,
  43: B,
  44: A,
  45: C,
  46: B,
  47: A,
  48: D,
  49: D,
  50: A,
  51: C,
  52: A,
  53: C,
}

export const PERCENTAGE_CHAMPION_PACK: PercentagePackItem[] = [
  q(
    1,
    'A number is first increased by 16% and then increased by 14%. The number, so obtained, is now decreased by 30%. What is the net increase or decrease percent in the original number (nearest to an integer)?',
    ['6% increase', '9% decrease', '7% decrease', 'No increment no decrement'],
    2,
    'SSC CGL MAINS 2018 {11 Sept. 2019}',
  ),
  q(
    2,
    'In a constituency, 55% of the total number of voters are males and the rest are females. If 40% of the males are illiterate and 40% of the females are literate, then by what percent is the number of literate males more than that of illiterate females?',
    ['22 8/11', '18 2/9', '18 2/11', '22 2/9'],
    3,
    'SSC CGL MAINS 2018 {11 Sept. 2019}',
  ),
  q(
    3,
    'If the radius of a right circular cylinder is decreased by 20% while its height is increased by 40%, then the percentage change in its volume will be:',
    [
      'No increase no decrease',
      '10.4% decrease',
      '1.04% increase',
      '10.4% increase',
    ],
    1,
    'SSC CGL MAINS 2018 {11 Sept. 2019}',
  ),
  q(
    4,
    'Raghav spends 80% of his income. If his income increases by 12% and the savings decrease by 10%, then what will be the percentage increase in his expenditure?',
    ['22', '16', '17.5', '20.5'],
    2,
    'SSC CGL MAINS 2018 {11 Sept. 2019}',
  ),
  q(
    5,
    'If A is 28% more than B and C is 25% less than the sum of A and B, then by what percent will C be more than A (correct to one decimal place)?',
    ['28%', '33.6%', '43%', '32.2%'],
    1,
    'SSC CGL MAINS 2018 {11 Sept. 2019}',
  ),
  q(
    6,
    'When the price of an item reduced by 25%, then its sale was increased by x%. If there is an increase of 20% in the receipt of the revenue, then the value of x will be:',
    ['75', '50', '45', '60'],
    3,
    'SSC CGL MAINS 2018 {11 Sept. 2019}',
  ),
  q(
    7,
    'If 60% of a number is 120 more than 20% of the number, then 28% of the number is less than 33 1/3% of the number by:',
    ['14', '12', '16', '15'],
    2,
    'SSC CGL MAINS 2018 {12 Sept. 2019}',
  ),
  q(
    8,
    'A is 25% more than B and B is 40% less than C. If C is 30% more than D, then by what percent is A less than D?',
    ['1.5', '2.5', '4', '5'],
    1,
    'SSC CGL MAINS 2018 {12 Sept. 2019}',
  ),
  q(
    9,
    'In a class, 83 1/3% of the number of students are girls and the rest are boys. If 60% of the number of boys and 80% of the number of girls are present, then what percentage of the total number of students in the class is absent?',
    ['26 2/3', '22 2/3', '23 1/3', '12 1/3'],
    2,
    'SSC CGL MAINS 2018 {12 Sept. 2019}',
  ),
  q(
    10,
    'A spends 65% of his income. His income is increased by 20% and his expenditure is increased by 25%. His savings will:',
    [
      'Increase by 11%',
      'Increase by 5%',
      'Decrease by 5%',
      'Decrease by 11%',
    ],
    0,
    'SSC CGL MAINS 2018 {12 Sept. 2019}',
  ),
  q(
    11,
    'If the diameter of the base of a right circular cylinder is reduced by 33 1/3% and its height is doubled, then the volume of the cylinder will:',
    [
      'increase by 1 1/9%',
      'remain unchanged',
      'increase by 11 1/9%',
      'decrease by 11 1/9%',
    ],
    3,
    'SSC CGL MAINS 2018 {12 Sept. 2019}',
  ),
  q(
    12,
    'If the price of petrol increases by 19% and Sunitha intends to spend only an additional 12% on petrol, by what percent should she reduce the quantity of petrol purchased (nearest to an integer)?',
    ['7', '6', '5', '8'],
    1,
    'SSC CGL MAINS 2018 {13 Sept. 2019}',
  ),
  q(
    13,
    'The radius of the base of a right circular cylinder is increased by 20%. By what percent should its height be reduced so that its volume remains the same as before?',
    ['25', '30 2/9', '30 5/9', '28'],
    2,
  ),
  q(
    14,
    'Monika spends 72% of her income. If her income increases by 20% and savings increase by 15%, then her expenditure increases by: (correct to 1 decimal place)',
    ['20.8%', '20.2%', '21.9%', '19.8%'],
    2,
  ),
  q(
    15,
    'The price of oil is increased by 20%. However, its consumption decreased by 8 1/3%. What is the percentage increase or decrease in the expenditure on it?',
    [
      'Increase by 10%',
      'Increase by 5%',
      'Decrease by 10%',
      'Decrease by 5%',
    ],
    0,
  ),
  q(
    16,
    "Basir's working hours per day were increased by 15% and his wages per hour were increased by 20%. By how much percent did daily earnings increase?",
    ['40', '38', '35', '36'],
    1,
  ),
  q(
    17,
    'If 25% of half of x is equal to 2.5 times the value of 30% of one-fourth of y, then x is what per cent more or less than y?',
    ['33 1/3% more', '50% more', '33 1/3% less', '50% less'],
    1,
  ),
  q(
    18,
    'In an examination, A obtained 10% more marks than B. B obtained 20% more marks than C and C obtained 32% less marks than D. If A obtained 272 more marks than C, then the marks obtained by B is:',
    ['850', '816', '1020', '952'],
    2,
    'SSC CGL MAINS 2019 {15 Nov. 2020}',
  ),
  q(
    19,
    'Anuja owns 66 2/3% of a property. If 30% of the property that she owns is worth ₹1,25,000, then 45% of the value (in ₹) of the property is:',
    ['2,70,000', '2,62,500', '2,81,250', '2,25,000'],
    2,
  ),
  q(
    20,
    'A certain number of students from school X appeared in an examination and 30% students failed. 150% more students than those from school X appeared in the same examination from school Y. If 80% of the total number of students who appeared from X and Y passed, then what is the percentage of students who failed from Y?',
    ['18', '20', '16', '24'],
    2,
  ),
  q(
    21,
    'If the radius of the base of a right circular cylinder is increased by 20% and the height is decreased by 30% then what is the percentage increase/decrease in the volume?',
    ['Increase 2%', 'Decrease 0.8%', 'Increase 0.8%', 'Decrease 2%'],
    2,
  ),
  q(
    22,
    'Rishu saves x% of her income. If her income increases by 26% and the expenditure increases by 20%, then her savings increase by 50%. What is the value of x?',
    ['30', '20', '10', '25'],
    1,
  ),
  q(
    23,
    'If (x + 20)% of 250 is 25% more than x% of 220, then 10% of (x + 50) is what per cent less than 15% of x?',
    ['13 1/3', '8 1/3', '16 2/3', '33 1/3'],
    2,
  ),
  q(
    24,
    'A is 80% more than B and C is 48 4/7% less than the sum of A and B. By what percent is C less than A?',
    ['20', '25', '30', '15'],
    0,
    'SSC CGL MAINS 2019 {16 Nov. 2020}',
  ),
  q(
    25,
    'If A is 40% less than B and C is 40% of the sum of A and B, then by what percentage is B greater than C?',
    ['60', '40 1/8', '56 1/4', '36'],
    2,
    'SSC CGL MAINS 2019 {16 Nov. 2020}',
  ),
  q(
    26,
    '[25% of (50% of 30% of 150)] / [40% of 2250] = ?',
    ['0.825%', '0.25%', '0.625%', '0.225%'],
    2,
  ),
  q(
    27,
    'The monthly salaries of A and B are the same. A, B and C donate 10%, 8% and 9% respectively, of their monthly salaries to a charitable trust. The difference between the donations of A and B is ₹400. The total donation by A and B is ₹900 more than that of C. What is the monthly salary of C?',
    ['₹25,000', '₹36,000', '₹30,000', '₹27,000'],
    2,
  ),
  q(
    28,
    'Renu saves 20% of her income. If her expenditure increases by 20% and income increases by 29%, then her savings increase by:',
    ['60%', '65%', '55%', '54%'],
    1,
  ),
  q(
    29,
    'What is to be added to 15% of 180 so that the sum is equal to 20% of 360?',
    ['60', '45', '50', '40'],
    1,
    'SSC CGL MAINS 2019 {18 Nov. 2020}',
  ),
  q(
    30,
    'In an examination, 92% of the students passed and 480 students failed. How many students appeared in the examination?',
    ['6000', '5800', '5000', '6200'],
    0,
  ),
  q(
    31,
    "If A's income is 60% less than B's income, then B's income is what percentage more than that of A's income?",
    ['150%', '80%', '120%', '40%'],
    0,
  ),
  q(
    32,
    'If the radius of a cylinder is decreased by 20% and the height is increased by 20% to form a new cylinder, then the volume will be decreased by:',
    ['20.5%', '32.2%', '23.2%', '22.3%'],
    2,
  ),
  q(
    33,
    'The train ticket fare from places A to B in 2nd class AC and 3rd class AC is ₹2,500 and ₹2,000, respectively. If the fares of 2nd class AC and 3rd class AC are increased by 20% and 10%, respectively, then find the ratio of the new fares of 2nd class AC and 3rd class AC.',
    ['15:13', '13:11', '15:11', '12:11'],
    2,
  ),
  q(
    34,
    'When the price of an item was reduced by 20%, its sale increased by x%. If there is an increase of 25% in receipt of the revenue, then the value of x is:',
    ['55.35', '57.75', '56.25', '54.35'],
    2,
    'SSC CGL MAINS 2020 {29 Jan. 2022}',
  ),
  q(
    35,
    'If the sum of 40% of a number and 30% of the same number is 70, then the number is:',
    ['150', '200', '100', '125'],
    2,
  ),
  q(
    36,
    'A saves 35% of his income. If his income increases by 20.1% and his expenditure increases by 20%, then by what percentage do his savings increase or decrease? (correct to one decimal place)',
    [
      '19.75% of decrease',
      '20.3% of increase',
      '18.5% of decrease',
      '21.9% of increase',
    ],
    1,
  ),
  q(
    37,
    "The income of A is 80% of B's income and the expenditure of A is 60% of B's expenditure. If the income of A is equal to 90% of B's expenditure, then by what percentage are the savings of A more than B's savings?",
    ['100%', '140%', '125%', '150%'],
    1,
  ),
  q(
    38,
    'The monthly expenses of a person are 66 2/3% more than her monthly savings. If her monthly income increases by 44% and her monthly expenses increases by 60%, then there is an increase of ₹1,040 in her monthly savings. What is the initial expenditure (in ₹)?',
    ['9,000', '12,000', '10,000', '13,000'],
    2,
  ),
  q(
    39,
    'A person saves 33 1/3% of his income. If the saving increases by 22% and the expenditure increases by 10%, then the percentage increase in his income is:',
    ['18%', '14%', '16%', '22%'],
    1,
    'SSC CGL MAINS 2020 {03 Feb. 2022}',
  ),
  q(
    40,
    'In an examination, B obtained 20% more marks than those obtained by A, and A obtained 10% less marks than those obtained by C. D obtained 20% more marks than those obtained by C. By what percentage are the marks obtained by D more than those obtained by A?',
    ['33 1/3%', '13 1/3%', '43 1/3%', '23 1/3%'],
    0,
  ),
  q(
    41,
    'The value of 17 1/2% of 3 1/4% of 33 1/3% of 7200 is:',
    ['7.65', '11.68', '13.65', '9.65'],
    2,
  ),
  q(
    42,
    'If 91% of A is 39% of B, and B is x% of A, then the value of x is:',
    ['200/3', '700/3', '400/3', '500/3'],
    1,
  ),
  q(
    43,
    'The monthly salary of a person was ₹1,60,000. He used to spend on three heads — Personal and family expenses (P), Taxes (T) and Education loan (E). The rest were his savings. P was 50% of the income, E was 20% of P, and T was 15% of E. When his salary got raised by 30%, he maintained the percentage level of P, but E became 30% of P and T became 20% of E. The sum of the two savings (in ₹) is:',
    ['2,11,680', '1,28,160', '1,18,620', '1,62,810'],
    1,
    'SSC CGL MAINS 2021 {08 Aug. 2022}',
  ),
  q(
    44,
    'Salaries of B, C, D and E are in the ratio of 2 : 3 : 4 : 5 respectively. Their salaries are increased by 20 percent, 30 percent, 40 percent and 50 percent respectively. If the increased salary of D is ₹560, then what is the sum of the original salaries of B, C, D and E?',
    ['₹1400', '₹1560', '₹1820', '₹1260'],
    0,
  ),
  q(
    45,
    'Raju spends 10 percent and 20 percent of his income on transport and food respectively. He spends 30 percent of the remaining income on clothing. He saves rest of his income. If his saving is ₹26460, then what will be total expenditure on food and clothing together?',
    ['₹26420', '₹24480', '₹22140', '₹23440'],
    2,
  ),
  q(
    46,
    'Price of rice is decreased by 25 percent and therefore a person can purchase 30 kg more rice in the same expenditure. If expenditure is ₹5400, then what was the original price of rice per kg?',
    ['₹90 per kg', '₹60 per kg', '₹75 per kg', '₹50 per kg'],
    1,
  ),
  q(
    47,
    "Rohit's income is ₹32000. If his expenses is 30 percent of total income, then what will be the saving of Rohit?",
    ['₹22400', '₹19200', '₹24600', '₹18600'],
    0,
  ),
  q(
    48,
    'Salary of Mohit is 60 percent more than Vijay. Salary of Vijay is how much percent less than Mohit?',
    ['42.5', '47.5', '45', '37.5'],
    3,
  ),
  q(
    49,
    "Three years ago, Raman's salary was ₹45000. His salary is increased by 10 percent, A percent and 20 percent in first, second and third year respectively. Raman's present salary is ₹83160. What is the value of A?",
    ['50', '30', '54', '40'],
    3,
  ),
  q(
    50,
    'Two numbers are, respectively, 10% and 25% more than the third number. The ratio of the two numbers is:',
    ['22 : 25', '19 : 25', '23 : 25', '18 : 25'],
    0,
    'SSC CGL 2022 Tier-II',
  ),
  q(
    51,
    'A basket contains 350 eggs. If 12% of the eggs are rotten, how many eggs are good enough to be sold?',
    ['408', '310', '308', '410'],
    2,
    'SSC CGL 2022 Tier-II',
  ),
  q(
    52,
    'Two candidates contested an election. One of them got 64% of the votes and won by 434 votes. What was the total number of votes polled?',
    ['1550', '1345', '1680', '1684'],
    0,
    'SSC CGL 2022 Tier-II',
  ),
  q(
    53,
    'If 20% of (A + B) = 30% of (A − B), then what percentage of B is equal to A?',
    ['400%', '300%', '500%', '100%'],
    2,
    'SSC CGL 2022 Tier-II',
  ),
]

/** Tiny transparent GIF — stem-only bank items need no photo. */
export const STEM_ONLY_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
