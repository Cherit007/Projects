import type { Topic, TopicArea } from './types'

/** Shared topic graph — one tick updates every exam that references the same id. */
export const TOPICS: Topic[] = [
  // ── Quantitative Aptitude (BankersAdda / Oliveboard / Adda247 style) ──
  {
    id: 'qa-number-system',
    area: 'quant',
    title: 'Number System & Simplification',
    subtopics: [
      'LCM / HCF & divisibility',
      'Surds, indices, BODMAS',
      'Approximation & simplification tricks',
      'Unit digit & remainder basics',
    ],
    note: 'Prelims speed topic — Bank PO / SO / RBI P1',
  },
  {
    id: 'qa-percent-pl',
    area: 'quant',
    title: 'Percentage, Profit & Loss',
    subtopics: [
      'Percentage change & successive %',
      'Profit, loss, discount, marked price',
      'Partnership basics',
      'Mixture of % with DI',
    ],
  },
  {
    id: 'qa-si-ci',
    area: 'quant',
    title: 'Simple & Compound Interest',
    subtopics: [
      'SI / CI formulae & comparison',
      'Installments & effective rate',
      'Population & depreciation',
      'CI–SI difference shortcuts',
    ],
  },
  {
    id: 'qa-ratio',
    area: 'quant',
    title: 'Ratio, Proportion & Partnership',
    subtopics: [
      'Ratio & proportion',
      'Ages & mixtures',
      'Partnership (capital × time)',
      'Alligation rule',
    ],
  },
  {
    id: 'qa-time-work',
    area: 'quant',
    title: 'Time, Work & Pipes',
    subtopics: [
      'Work–efficiency',
      'Pipes & cisterns',
      'Work with wages',
      'Alternate day work',
    ],
  },
  {
    id: 'qa-speed',
    area: 'quant',
    title: 'Speed, Time & Distance',
    subtopics: [
      'Average speed',
      'Trains & relative speed',
      'Boats & streams',
      'Races & circular tracks',
    ],
  },
  {
    id: 'qa-mensuration',
    area: 'quant',
    title: 'Mensuration & Geometry basics',
    subtopics: [
      '2D area / perimeter',
      '3D volume / surface',
      'Circles & triangles basics',
      'Quick formula sheet',
    ],
  },
  {
    id: 'qa-algebra',
    area: 'quant',
    title: 'Algebra & Quadratic',
    subtopics: [
      'Linear equations',
      'Quadratic equations & roots',
      'Inequalities basics',
      'Number series (missing / wrong)',
    ],
  },
  {
    id: 'qa-permutation',
    area: 'quant',
    title: 'Permutation, Combination & Probability',
    subtopics: [
      'nPr / nCr',
      'Circular permutation',
      'Basic probability',
      'Cards / dice / coins problems',
    ],
  },
  {
    id: 'qa-di',
    area: 'quant',
    title: 'Data Interpretation',
    subtopics: [
      'Table / bar / line / pie',
      'Caselet DI',
      'Radar & missing DI',
      'DI with arithmetic mix',
    ],
    note: 'Heavy in IBPS/SBI Mains & RBI P1',
  },
  {
    id: 'qa-ds',
    area: 'quant',
    title: 'Data Sufficiency (Quant)',
    subtopics: [
      'Two-statement DS',
      'Quant DS traps',
      'Comparison-type DS',
    ],
  },

  // ── Reasoning ──
  {
    id: 're-puzzle',
    area: 'reasoning',
    title: 'Puzzles & Seating',
    subtopics: [
      'Linear / circular seating',
      'Floor / box / shelf puzzles',
      'Scheduling & month-day',
      'Blood-relation puzzles',
    ],
    note: 'Highest weight in bank prelims/mains',
  },
  {
    id: 're-inequality',
    area: 'reasoning',
    title: 'Inequality & Syllogism',
    subtopics: [
      'Coded inequality',
      'Direct inequality',
      'Syllogism (Venn / possibility)',
      'Reverse syllogism',
    ],
  },
  {
    id: 're-coding',
    area: 'reasoning',
    title: 'Coding–Decoding & Input–Output',
    subtopics: [
      'Letter/number coding',
      'New pattern coding',
      'Machine input–output',
      'Chinese coding',
    ],
  },
  {
    id: 're-blood',
    area: 'reasoning',
    title: 'Blood Relation & Direction',
    subtopics: [
      'Coded blood relation',
      'Family tree',
      'Direction sense',
      'Distance with turns',
    ],
  },
  {
    id: 're-order',
    area: 'reasoning',
    title: 'Order, Ranking & Alphabet',
    subtopics: [
      'Ranking in row/column',
      'Order & sequence',
      'Alphabet & number series',
      'Dictionary order',
    ],
  },
  {
    id: 're-critical',
    area: 'reasoning',
    title: 'Critical Reasoning & Assumptions',
    subtopics: [
      'Statement–assumption',
      'Course of action',
      'Cause–effect',
      'Strengthening / weakening',
    ],
    note: 'RBI / SEBI / NABARD Phase II style',
  },
  {
    id: 're-ds',
    area: 'reasoning',
    title: 'Data Sufficiency (Reasoning)',
    subtopics: [
      'Puzzle DS',
      'Blood / direction DS',
      'Ordering DS',
    ],
  },

  // ── English ──
  {
    id: 'en-rc',
    area: 'english',
    title: 'Reading Comprehension',
    subtopics: [
      'Economy / banking passages',
      'Inference & tone',
      'Vocabulary in context',
      'Speed reading drills',
    ],
  },
  {
    id: 'en-grammar',
    area: 'english',
    title: 'Grammar & Error Spotting',
    subtopics: [
      'Subject–verb agreement',
      'Tenses & articles',
      'Prepositions & connectors',
      'Error spotting / sentence improvement',
    ],
  },
  {
    id: 'en-vocab',
    area: 'english',
    title: 'Vocabulary & Cloze',
    subtopics: [
      'Synonyms / antonyms',
      'Idioms & phrases',
      'Cloze test',
      'Fillers (single / double)',
    ],
  },
  {
    id: 'en-para',
    area: 'english',
    title: 'Para Jumbles & Connectors',
    subtopics: [
      'Sentence rearrangement',
      'Paragraph completion',
      'Connectors / starters',
      'Odd sentence out',
    ],
  },

  // ── Descriptive English ──
  {
    id: 'de-essay',
    area: 'desc-eng',
    title: 'Essay Writing',
    subtopics: [
      'Economy / finance essays',
      'Social & governance topics',
      'Structure: intro–body–conclusion',
      'Word limit discipline (250–300)',
    ],
    note: 'RBI / SEBI / NABARD / PFRDA / SBI Mains',
  },
  {
    id: 'de-precis',
    area: 'desc-eng',
    title: 'Précis / Summary',
    subtopics: [
      'Compression without losing meaning',
      'Title selection',
      'Avoid copying phrases',
    ],
  },
  {
    id: 'de-letter',
    area: 'desc-eng',
    title: 'Letter / Report / Email',
    subtopics: [
      'Formal letter formats',
      'Office reports',
      'Email etiquette',
      'Argument writing',
    ],
  },

  // ── General Awareness ──
  {
    id: 'ga-current',
    area: 'ga',
    title: 'Current Affairs (6–12 months)',
    subtopics: [
      'National & international news',
      'Appointments & awards',
      'Sports & books',
      'Summits & MoUs',
      'Monthly CA revision (Oliveboard / AffairsCloud style)',
    ],
  },
  {
    id: 'ga-static',
    area: 'ga',
    title: 'Static GK',
    subtopics: [
      'Indian polity basics (Constitution, Parliament, fundamental rights)',
      'Modern Indian history & freedom movement (SSC depth)',
      'Geography (India + world basics)',
      'Science & tech basics (physics/chem/bio for CGL GA)',
      'Important days & organisations',
      'National parks / dams / HQ',
    ],
    note: 'Heavier for SSC CGL Tier-1/2 GA than bank exams',
  },
  {
    id: 'ga-economy',
    area: 'ga',
    title: 'Economy & Budget Snapshot',
    subtopics: [
      'Union Budget highlights',
      'Economic Survey themes',
      'Inflation, GDP, repo basics',
      'Govt schemes (flagship)',
    ],
  },

  // ── Banking Awareness ──
  {
    id: 'ba-rbi-basics',
    area: 'banking',
    title: 'RBI & Monetary Policy',
    subtopics: [
      'Repo / reverse repo / CRR / SLR / MSF',
      'MPC structure',
      'Tools of monetary policy',
      'RBI functions & departments (overview)',
    ],
    note: 'Shared across bank PO + regulators',
  },
  {
    id: 'ba-products',
    area: 'banking',
    title: 'Banking Products & Priority Sector',
    subtopics: [
      'CASA, NPA, SARFAESI',
      'Priority sector lending',
      'Types of accounts & cards',
      'Payment systems (UPI, NEFT, RTGS, IMPS)',
    ],
  },
  {
    id: 'ba-financial',
    area: 'banking',
    title: 'Financial Markets & Instruments',
    subtopics: [
      'Money market vs capital market',
      'G-Secs, T-Bills, CPs, CDs',
      'Mutual funds & insurance basics',
      'Basel norms overview',
    ],
  },
  {
    id: 'ba-schemes',
    area: 'banking',
    title: 'Govt / Bank Schemes',
    subtopics: [
      'PMJDY, MUDRA, Stand-Up India',
      'Digital India / DBT',
      'Recent banking mergers & reforms',
      'Financial inclusion indices',
    ],
  },

  // ── ESI (Economic & Social Issues) — EduTap / Anuj Jindal style ──
  {
    id: 'esi-growth',
    area: 'esi',
    title: 'Growth, Development & National Income',
    subtopics: [
      'GDP / GVA / GNP concepts',
      'Human Development & SDGs',
      'Poverty & inequality measures',
      'Employment & labour force',
    ],
    note: 'RBI Gr B / SEBI / NABARD / PFRDA / IRDAI',
  },
  {
    id: 'esi-inflation',
    area: 'esi',
    title: 'Inflation, Monetary & Fiscal',
    subtopics: [
      'CPI / WPI / GDP deflator',
      'Causes & control of inflation',
      'Fiscal policy & deficits',
      'FRBM overview',
    ],
  },
  {
    id: 'esi-social',
    area: 'esi',
    title: 'Social Sector & Schemes',
    subtopics: [
      'Health, education, gender',
      'Social security & pensions',
      'Flagship central schemes',
      'Urbanisation & migration',
    ],
  },
  {
    id: 'esi-sustainable',
    area: 'esi',
    title: 'Sustainable Development & Climate',
    subtopics: [
      'Climate agreements & India NDCs',
      'Green finance & ESG basics',
      'Energy transition',
      'Environment vs development debates',
    ],
  },
  {
    id: 'esi-global',
    area: 'esi',
    title: 'Globalisation & International Orgs',
    subtopics: [
      'IMF, World Bank, WTO, ADB',
      'BRICS / G20',
      'Trade & capital flows',
      'Global economic outlook themes',
    ],
  },
  {
    id: 'esi-reports',
    area: 'esi',
    title: 'Reports & Indices (ESI)',
    subtopics: [
      'Economic Survey chapters',
      'Budget documents reading',
      'RBI / NITI / UN reports',
      'Key development indices',
    ],
  },

  // ── Finance & Management ──
  {
    id: 'fm-basics',
    area: 'fm',
    title: 'Basics of Finance & Markets',
    subtopics: [
      'Time value of money',
      'Primary / secondary markets',
      'Equity, debt, derivatives overview',
      'SEBI role & market intermediaries',
    ],
    note: 'RBI P2 FM · SEBI · PFRDA · IRDAI',
  },
  {
    id: 'fm-ratio',
    area: 'fm',
    title: 'Financial Statements & Ratios',
    subtopics: [
      'Balance sheet / P&L / cash flow',
      'Liquidity & solvency ratios',
      'Profitability & efficiency ratios',
      'Reading company financials',
    ],
  },
  {
    id: 'fm-risk',
    area: 'fm',
    title: 'Risk, Banking & Regulation',
    subtopics: [
      'Credit / market / operational risk',
      'NPA management',
      'Capital adequacy (Basel)',
      'Financial stability concepts',
    ],
  },
  {
    id: 'fm-mgmt',
    area: 'fm',
    title: 'Management & Organisational Behaviour',
    subtopics: [
      'Leadership & motivation theories',
      'Communication & conflict',
      'HR basics & performance',
      'Ethics & corporate governance',
    ],
  },
  {
    id: 'fm-fintech',
    area: 'fm',
    title: 'FinTech, Digital Banking & Cyber',
    subtopics: [
      'UPI / account aggregators',
      'CBDC overview',
      'Cybersecurity in finance',
      'RegTech / SupTech themes',
    ],
  },

  // ── ARD (Agriculture & Rural Development) — NABARD ──
  {
    id: 'ard-agri',
    area: 'ard',
    title: 'Agriculture Basics & Agronomy',
    subtopics: [
      'Crops, seasons, irrigation',
      'Soil & fertilisers',
      'Horticulture & animal husbandry overview',
      'Agri economics basics',
    ],
    note: 'NABARD Grade A — Phase I & II',
  },
  {
    id: 'ard-rural',
    area: 'ard',
    title: 'Rural Development & Institutions',
    subtopics: [
      'Panchayati Raj & rural governance',
      'NRLM / MGNREGA / PMAY-G',
      'Cooperatives & FPOs',
      'Rural credit structure',
    ],
  },
  {
    id: 'ard-finance',
    area: 'ard',
    title: 'Rural & Agri Finance',
    subtopics: [
      'NABARD role & refinance',
      'RRBs / cooperatives / MFIs',
      'KCC, crop insurance (PMFBY)',
      'Priority sector & agri lending',
    ],
  },
  {
    id: 'ard-schemes',
    area: 'ard',
    title: 'Agri / Rural Schemes & Reports',
    subtopics: [
      'Flagship agri schemes',
      'Food processing & marketing',
      'NABARD annual reports themes',
      'Climate-smart agriculture',
    ],
  },

  // ── Computer / IT Professional Knowledge ──
  {
    id: 'comp-fundamentals',
    area: 'computer',
    title: 'Computer Fundamentals & OS',
    subtopics: [
      'Hardware / software / memory hierarchy',
      'OS concepts: process, threads, scheduling',
      'Deadlock, memory management',
      'Linux basics & commands',
    ],
    note: 'IBPS SO IT · SEBI IT · RRB IT · bank computer awareness',
  },
  {
    id: 'comp-networking',
    area: 'computer',
    title: 'Computer Networks',
    subtopics: [
      'OSI / TCP-IP models',
      'IP addressing, subnetting',
      'Routing, switching, DNS, DHCP',
      'HTTP/HTTPS, SMTP, FTP',
    ],
  },
  {
    id: 'comp-dbms',
    area: 'computer',
    title: 'DBMS & SQL',
    subtopics: [
      'ER model & normalisation',
      'SQL queries (joins, aggregate)',
      'Transactions & ACID',
      'Indexing & basic NoSQL',
    ],
  },
  {
    id: 'comp-dsa',
    area: 'computer',
    title: 'DSA & Programming Basics',
    subtopics: [
      'Arrays, stacks, queues, trees, graphs',
      'Sorting & searching',
      'Complexity analysis',
      'OOP concepts (Java/C++/Python)',
    ],
  },
  {
    id: 'comp-security',
    area: 'computer',
    title: 'Cybersecurity & Cryptography',
    subtopics: [
      'CIA triad, threats & attacks',
      'Firewalls, IDS/IPS, VPN',
      'Symmetric / asymmetric crypto',
      'OWASP basics & secure coding',
    ],
  },
  {
    id: 'comp-se',
    area: 'computer',
    title: 'Software Engineering & SDLC',
    subtopics: [
      'SDLC models (Waterfall, Agile, DevOps)',
      'Requirements & design',
      'Testing types',
      'Version control & CI/CD basics',
    ],
  },
  {
    id: 'comp-web',
    area: 'computer',
    title: 'Web, Cloud & Emerging Tech',
    subtopics: [
      'Web technologies (HTML/CSS/JS overview)',
      'Cloud models (IaaS/PaaS/SaaS)',
      'AI/ML / Big Data basics for exams',
      'IoT & blockchain overview',
    ],
  },
  {
    id: 'comp-ms-office',
    area: 'computer',
    title: 'MS Office & Digi Banking Tools',
    subtopics: [
      'Word / Excel / PowerPoint essentials',
      'Shortcuts & formulas',
      'E-banking channels',
      'Computer abbreviations',
    ],
  },

  // ── GATE CS (GeeksforGeeks / Made Easy / GATE Academy style) ──
  {
    id: 'gate-algo',
    area: 'gate-cs',
    title: 'Algorithms (GATE CS)',
    subtopics: [
      'Asymptotic analysis',
      'Divide & conquer, greedy, DP',
      'Graph algorithms (BFS/DFS, shortest path, MST)',
      'NP-completeness overview',
    ],
    note: 'NIC / DRDO / POWERGRID / ISRO / BARC / Oil PSUs',
  },
  {
    id: 'gate-ds',
    area: 'gate-cs',
    title: 'Data Structures (GATE CS)',
    subtopics: [
      'Arrays, linked lists, stacks, queues',
      'Trees, heaps, BST, AVL',
      'Graphs & hashing',
      'File structures basics',
    ],
  },
  {
    id: 'gate-toc',
    area: 'gate-cs',
    title: 'Theory of Computation',
    subtopics: [
      'Regular languages & FA',
      'CFG & PDA',
      'Turing machines',
      'Decidability basics',
    ],
  },
  {
    id: 'gate-compiler',
    area: 'gate-cs',
    title: 'Compiler Design',
    subtopics: [
      'Lexical analysis & parsing',
      'Syntax-directed translation',
      'Intermediate code',
      'Runtime environment & optimisation basics',
    ],
  },
  {
    id: 'gate-os',
    area: 'gate-cs',
    title: 'Operating Systems (GATE depth)',
    subtopics: [
      'Processes, threads, concurrency',
      'CPU scheduling algorithms',
      'Memory & virtual memory',
      'File systems & I/O',
    ],
  },
  {
    id: 'gate-db',
    area: 'gate-cs',
    title: 'Databases (GATE depth)',
    subtopics: [
      'Relational algebra & SQL',
      'Normal forms',
      'Transactions, concurrency control',
      'Indexing & query processing',
    ],
  },
  {
    id: 'gate-cn',
    area: 'gate-cs',
    title: 'Computer Networks (GATE depth)',
    subtopics: [
      'Physical / data link / network / transport',
      'Flow & congestion control',
      'Application layer protocols',
      'Network security basics',
    ],
  },
  {
    id: 'gate-digital',
    area: 'gate-cs',
    title: 'Digital Logic & COA',
    subtopics: [
      'Boolean algebra, combinational / sequential',
      'Number systems',
      'CPU organisation, pipelining',
      'Cache, memory hierarchy, I/O',
    ],
  },
  {
    id: 'gate-engmath',
    area: 'gate-cs',
    title: 'Engineering Mathematics & Discrete',
    subtopics: [
      'Discrete maths (sets, relations, graphs)',
      'Linear algebra & calculus essentials',
      'Probability & statistics',
      'Numerical methods overview',
    ],
  },
  {
    id: 'gate-programming',
    area: 'gate-cs',
    title: 'Programming & Discrete Logic',
    subtopics: [
      'C programming nuances',
      'Recursion & pointers',
      'Propositional & predicate logic',
      'Combinatorics for GATE',
    ],
  },

  // ── Interview ──
  {
    id: 'iv-hr',
    area: 'interview',
    title: 'HR & Profile Questions',
    subtopics: [
      'Tell me about yourself',
      'Why this organisation / why leave SDE',
      'Strengths, weaknesses, failures',
      'OBC-NCL documents readiness',
    ],
  },
  {
    id: 'iv-domain',
    area: 'interview',
    title: 'Domain / Organisation Awareness',
    subtopics: [
      'Org functions & recent news',
      'Role-specific knowledge',
      'Current affairs for interview',
      'Opinion on policy topics',
    ],
  },
  {
    id: 'iv-tech',
    area: 'interview',
    title: 'Technical Interview (CSE/IT)',
    subtopics: [
      'Projects deep-dive (4 YOE)',
      'DSA / system design lite',
      'OS / DB / Networks viva',
      'Security & best practices',
    ],
    note: 'SO IT · SEBI IT · NIC · ISRO · DRDO · AAI · CRIS',
  },
]

export const TOPIC_BY_ID: Record<string, Topic> = Object.fromEntries(
  TOPICS.map((t) => [t.id, t]),
)

export const AREA_LABELS: Record<TopicArea, string> = {
  quant: 'Quantitative Aptitude',
  reasoning: 'Reasoning Ability',
  english: 'English Language',
  ga: 'General Awareness',
  banking: 'Banking & Financial Awareness',
  esi: 'Economic & Social Issues (ESI)',
  fm: 'Finance & Management (FM)',
  ard: 'Agriculture & Rural Development (ARD)',
  computer: 'Computer / IT Knowledge',
  'gate-cs': 'GATE CS / Engineering Sciences',
  'desc-eng': 'Descriptive English',
  interview: 'Interview & Personality',
}

export function topicsForIds(ids: string[]): Topic[] {
  return ids.map((id) => TOPIC_BY_ID[id]).filter(Boolean)
}
