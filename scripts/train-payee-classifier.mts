/**
 * Trains the payee classifier shipped in the app: person vs business, and
 * the expense category of a business.
 *
 *   node scripts/train-payee-classifier.mts [--verbose]
 *
 * Generates labelled Indian payee names (brands, descriptive shop names,
 * banks, people), trains a naive Bayes model on payeeFeatures, evaluates it
 * on held-out rows (people use names never seen in training) and writes
 * src/domain/categories/payeeModel.json.
 */
import { writeFileSync } from 'node:fs';

import {
  decidePayee,
  payeeFeatures,
  PERSON_CLASS as PERSON,
  scorePayee,
  UNKNOWN_CLASS as UNKNOWN,
} from '../src/domain/categories/payeeFeatures.ts';

const BRANDS: Record<string, string[]> = {
  'Food and dining': ['swiggy', 'zomato', 'eatsure', 'dominos', 'pizza hut', 'kfc', 'mcdonalds', 'burger king', 'subway', 'starbucks', 'cafe coffee day', 'chaayos', 'haldirams', 'barbeque nation', 'behrouz biryani', 'faasos', 'box8', 'wow momo', 'paradise biryani', 'meghana foods', 'adyar ananda bhavan', 'saravana bhavan', 'bikanervala', 'theobroma', 'baskin robbins', 'naturals ice cream', 'third wave coffee', 'blue tokai', 'chai point', 'rebel foods', 'empire restaurant', 'truffles', 'taco bell', 'la pinoz', 'biryani blues'],
  Groceries: ['bigbasket', 'blinkit', 'zepto', 'instamart', 'dmart', 'avenue supermarts', 'jiomart', 'reliance fresh', 'reliance smart', 'more retail', 'spencers', 'natures basket', 'ratnadeep', 'star bazaar', 'spar hypermarket', 'licious', 'freshtohome', 'country delight', 'milkbasket', 'nandini milk', 'amul', 'heritage foods', 'vijetha supermarket', 'bb daily', 'dunzo daily', 'grofers', 'kpn fresh', 'big bazaar'],
  Transport: ['uber', 'ola', 'rapido', 'namma yatri', 'blusmart', 'indian oil', 'iocl', 'hpcl', 'bpcl', 'hindustan petroleum', 'bharat petroleum', 'shell', 'nayara energy', 'fastag', 'delhi metro', 'bmrcl', 'mumbai metro', 'ksrtc', 'tsrtc', 'apsrtc', 'msrtc', 'yulu', 'bounce', 'park plus', 'jio bp', 'quick ride'],
  Shopping: ['amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'nykaa', 'tata cliq', 'croma', 'reliance digital', 'reliance trends', 'decathlon', 'ikea', 'lenskart', 'firstcry', 'pantaloons', 'westside', 'lifestyle stores', 'max fashion', 'zudio', 'uniqlo', 'bata', 'puma', 'nike', 'adidas', 'tanishq', 'malabar gold', 'kalyan jewellers', 'pothys', 'chennai silks', 'vijay sales', 'sangeetha mobiles', 'poorvika mobiles', 'samsung', 'boat lifestyle', 'snapdeal', 'shoppers stop', 'titan', 'raymond', 'fabindia', 'pepperfry', 'urban ladder', 'mamaearth', 'purplle'],
  'Utilities and bills': ['airtel', 'jio', 'reliance jio', 'vodafone idea', 'bsnl', 'act fibernet', 'hathway', 'tata play', 'dish tv', 'sun direct', 'bescom', 'tneb', 'tangedco', 'msedcl', 'mahadiscom', 'tata power', 'adani electricity', 'bses', 'cesc', 'tsspdcl', 'apspdcl', 'kseb', 'indane gas', 'hp gas', 'bharat gas', 'mahanagar gas', 'igl', 'bwssb', 'hmwssb', 'delhi jal board', 'electricity bill', 'mobile recharge', 'excitel', 'you broadband'],
  Healthcare: ['apollo pharmacy', 'apollo hospitals', 'pharmeasy', 'tata 1mg', 'netmeds', 'medplus', 'wellness forever', 'practo', 'cult fit', 'healthifyme', 'dr lal pathlabs', 'thyrocare', 'metropolis healthcare', 'manipal hospitals', 'fortis', 'max healthcare', 'narayana health', 'aster dm', 'rainbow children hospital', 'truemeds', 'frank ross pharmacy', 'vasan eye care'],
  Entertainment: ['netflix', 'spotify', 'disney hotstar', 'jiocinema', 'jiohotstar', 'prime video', 'youtube premium', 'bookmyshow', 'pvr', 'inox', 'cinepolis', 'sonyliv', 'zee5', 'steam', 'playstation', 'apple music', 'gaana', 'wynk', 'district by zomato', 'paytm insider', 'timezone', 'wonderla', 'smaaash', 'aha video', 'sun nxt', 'dream11'],
  Education: ['udemy', 'coursera', 'byjus', 'unacademy', 'vedantu', 'physics wallah', 'upgrad', 'simplilearn', 'great learning', 'toppr', 'duolingo', 'sapna book house', 'aakash institute', 'allen career institute', 'fiitjee', 'khan academy', 'scaler academy'],
  Travel: ['makemytrip', 'goibibo', 'cleartrip', 'yatra', 'ixigo', 'easemytrip', 'irctc', 'indigo', 'interglobe aviation', 'air india', 'akasa air', 'spicejet', 'vistara', 'oyo rooms', 'airbnb', 'booking com', 'agoda', 'treebo hotels', 'fabhotels', 'redbus', 'abhibus', 'zoomcar', 'thomas cook', 'taj hotels', 'lemon tree hotels'],
  'Rent and housing': ['nobroker', 'nestaway', 'magicbricks', 'housing com', 'mygate', 'nobrokerhood', 'stanza living', 'zolo stays', 'colive', 'square yards', 'urban company', 'adda apartment'],
  'Loan interest and fees': ['bajaj finance', 'bajaj finserv', 'tata capital', 'muthoot finance', 'manappuram finance', 'home credit', 'kreditbee', 'moneyview', 'navi finserv', 'lazypay', 'simpl', 'slice', 'cred', 'sbi card', 'hdfc credit card', 'icici credit card', 'axis credit card', 'loan emi', 'hdb financial', 'l t finance', 'aditya birla finance', 'iifl finance'],
};

const KEYWORDS: Record<string, string[]> = {
  'Food and dining': ['tiffins', 'tiffin centre', 'tiffin center', 'hotel', 'restaurant', 'family restaurant', 'mess', 'biryani', 'biryani house', 'cafe', 'bakery', 'bakers', 'sweets', 'sweet house', 'juice centre', 'juice point', 'tea stall', 'chai', 'dhaba', 'bhojanalaya', 'idli', 'dosa corner', 'fast food', 'canteen', 'caterers', 'pure veg', 'kitchen', 'food court', 'chaat', 'pani puri', 'ice cream', 'coffee house', 'bar and restaurant', 'darshini', 'udupi', 'foods', 'eatery', 'grill', 'tandoor', 'pizzeria', 'momos', 'shawarma', 'food plaza', 'tea point', 'bhavan', 'meals'],
  Groceries: ['kirana', 'kirana store', 'provision store', 'provisions', 'general stores', 'general store', 'supermarket', 'super market', 'departmental store', 'vegetables', 'vegetable shop', 'fruits', 'fruit stall', 'dairy', 'milk centre', 'milk dairy', 'grocery', 'groceries', 'mart', 'fresh mart', 'chicken centre', 'chicken shop', 'mutton shop', 'fish market', 'meat shop', 'rice traders', 'oil stores', 'hypermarket', 'daily needs', 'fresh', 'organics', 'egg centre', 'flour mill'],
  Transport: ['petroleum', 'petrol pump', 'petrol bunk', 'fuels', 'fuel station', 'filling station', 'service station', 'auto', 'cab', 'cabs', 'taxi', 'parking', 'toll plaza', 'toll', 'metro rail', 'bus', 'tyres', 'motors', 'auto works', 'car wash', 'garage', 'two wheeler service', 'bike service', 'automobiles', 'car care', 'battery', 'puncture shop', 'cng station'],
  Shopping: ['textiles', 'garments', 'fashion', 'fashions', 'footwear', 'shoes', 'jewellers', 'jewellery', 'electronics', 'mobiles', 'mobile shop', 'mobile world', 'gift centre', 'gifts', 'furniture', 'hardware', 'sarees', 'silks', 'collections', 'boutique', 'opticals', 'optics', 'watch co', 'cosmetics', 'home needs', 'emporium', 'readymades', 'tailors', 'computers', 'appliances', 'bags', 'toys', 'sports', 'sports shop', 'paints', 'lifestyle', 'mens wear', 'kids wear', 'novelty'],
  'Utilities and bills': ['electricity board', 'power distribution', 'electricity', 'water supply', 'water works', 'gas agency', 'gas agencies', 'broadband', 'fibernet', 'cable network', 'cable tv', 'recharge', 'telecom', 'dth', 'municipal corporation', 'property tax', 'postpaid', 'prepaid', 'internet services', 'power', 'utility', 'bill payment'],
  Healthcare: ['medicals', 'medical store', 'medical hall', 'pharmacy', 'pharma', 'chemists', 'chemist', 'chemist and druggist', 'druggists', 'hospital', 'hospitals', 'clinic', 'diagnostics', 'diagnostic centre', 'labs', 'pathlabs', 'dental care', 'dental clinic', 'eye care', 'eye hospital', 'nursing home', 'health care', 'healthcare', 'physiotherapy', 'ayurveda', 'ayurvedic', 'homeo', 'homoeopathy', 'medico', 'multispeciality', 'polyclinic', 'scan centre', 'surgicals', 'medicines'],
  Entertainment: ['cinemas', 'cinema', 'theatre', 'theatres', 'multiplex', 'gaming zone', 'gaming', 'amusement park', 'club', 'bowling', 'music', 'events', 'water park', 'fun world', 'snooker', 'play zone', 'concerts', 'entertainment'],
  Education: ['school', 'public school', 'high school', 'college', 'academy', 'institute', 'coaching centre', 'coaching', 'tuitions', 'tuition centre', 'classes', 'university', 'vidyalaya', 'vidya mandir', 'book depot', 'book house', 'books', 'educational trust', 'education', 'learning centre', 'play school', 'montessori', 'kids school', 'stationery', 'stationers'],
  Travel: ['tours and travels', 'tours travels', 'travels', 'tours', 'holidays', 'resorts', 'resort', 'lodge', 'guest house', 'residency', 'inn', 'homestay', 'airways', 'airlines', 'travel agency', 'hotels and resorts', 'stays', 'tourism', 'boarding and lodging'],
  'Rent and housing': ['rent', 'house rent', 'rentals', 'estates', 'properties', 'apartment owners association', 'apartments', 'society', 'housing society', 'welfare association', 'maintenance', 'pg', 'paying guest', 'hostel', 'realty', 'builders', 'developers', 'flat maintenance', 'residents association'],
  'Loan interest and fees': ['finance', 'finserv', 'fincorp', 'capital', 'credit', 'loans', 'emi', 'credit card', 'card payment', 'microfinance', 'gold loan', 'chit fund', 'chits', 'fin', 'financial services', 'housing finance', 'nbfc'],
};

/** Payees the model should not put in a spending category: banks, gateways, vague business names. */
const BANKS = ['hdfc bank', 'icici bank', 'state bank of india', 'sbi', 'axis bank', 'kotak mahindra bank', 'kotak bank', 'yes bank', 'idfc first bank', 'indusind bank', 'bank of baroda', 'canara bank', 'punjab national bank', 'union bank of india', 'bank of india', 'indian bank', 'central bank of india', 'indian overseas bank', 'uco bank', 'federal bank', 'south indian bank', 'karur vysya bank', 'city union bank', 'rbl bank', 'bandhan bank', 'au small finance bank', 'equitas small finance bank', 'ujjivan small finance bank', 'idbi bank', 'dbs bank', 'standard chartered', 'hsbc', 'citibank', 'paytm payments bank', 'airtel payments bank', 'india post payments bank', 'fino payments bank', 'karnataka bank', 'tamilnad mercantile bank', 'dcb bank', 'saraswat bank', 'cosmos bank', 'cooperative bank', 'gramin bank'];
const GATEWAYS = ['razorpay', 'cashfree', 'payu', 'billdesk', 'ccavenue', 'paytmqr', 'paytm', 'phonepe', 'bharatpe', 'mswipe', 'pinelabs', 'pine labs', 'easebuzz', 'instamojo', 'juspay', 'mobikwik', 'freecharge', 'google pay', 'amazon pay', 'cred club', 'payment gateway', 'merchant', 'upi merchant'];
const VAGUE = ['enterprises', 'traders', 'trading co', 'trading company', 'associates', 'agencies', 'agency', 'solutions', 'services', 'industries', 'corporation', 'exports', 'imports', 'infotech', 'ventures', 'global', 'group', 'technologies', 'tech', 'consultants', 'consultancy', 'company', 'impex', 'marketing', 'distributors', 'wholesale', 'merchants', 'business', 'payments', 'innovations', 'retail', 'online', 'brothers', 'sons', 'and sons', 'and co', 'works', 'systems', 'networks', 'labs pvt ltd', 'holdings', 'international', 'overseas', 'logistics', 'suppliers', 'store', 'stores', 'shop', 'centre', 'center', 'point', 'world', 'zone', 'hub', 'mart and co', 'bazaar'];

const PREFIXES = ['sri', 'shree', 'sree', 'shri', 'new', 'royal', 'balaji', 'ganesh', 'lakshmi', 'sai', 'krishna', 'venkateswara', 'annapurna', 'murugan', 'durga', 'om', 'jai', 'maa', 'raj', 'star', 'city', 'green', 'golden', 'kumar', 'modern', 'national', 'famous', 'delhi', 'mumbai', 'hyderabad', 'chennai', 'bangalore', 'amma', 'janata', 'apna', 'sagar', 'vinayaka', 'hanuman', 'mahalakshmi', 'srinivasa', 'bharat', 'india', 'metro', 'deccan', 'kaveri', 'ganga', 'ashirwad', 'shiv', 'jagdamba', 'ambika', 'patel', 'gupta', 'agarwal', 'reddy', 'nair', 'singh', 'sunrise', 'paradise', 'galaxy', 'classic', 'supreme', 'universal', 'perfect', 'friends', 'trust', 'smart', 'quality', 'prime', 'best', 'super', 'tirumala', 'tirupati', 'ayyappa', 'saraswati', 'kamakshi', 'meenakshi', 'jyothi', 'vasavi', 'padmavathi', 'ram', 'sita', 'radhe', 'gopal', 'mahadev', 'bhagyalakshmi', 'kalpana', 'sapna', 'aadhya', 'shanti', 'navya', 'vijaya', 'jaya'];

const SUFFIXES = ['', '', '', '', ' pvt ltd', ' private limited', ' ltd', ' and co', ' & sons', ' enterprises', ' india', ' llp'];

// Each list is split: most names train the model, the rest only appear in the evaluation.
const FIRST_NAMES = ['rahul', 'priya', 'suresh', 'ramesh', 'anita', 'sunita', 'vijay', 'ajay', 'deepak', 'pooja', 'neha', 'amit', 'rohit', 'sanjay', 'kavita', 'arun', 'karthik', 'lakshmi', 'venkatesh', 'srinivas', 'mohammed', 'imran', 'fatima', 'joseph', 'mary', 'thomas', 'gurpreet', 'harpreet', 'manoj', 'rajesh', 'mahesh', 'naveen', 'praveen', 'divya', 'swathi', 'anil', 'sunil', 'ravi', 'kiran', 'sandeep', 'vikram', 'arjun', 'aditya', 'sneha', 'meena', 'geeta', 'ashok', 'prakash', 'santosh', 'ganesh', 'murali', 'balaji', 'cherit', 'sai', 'chandra', 'shankar', 'abdul', 'ayesha', 'farhan', 'nikhil', 'anjali', 'irfan', 'kavitha', 'srinivasa', 'venkata', 'ramana', 'nagaraju', 'satish', 'harish', 'girish', 'yogesh', 'mukesh', 'dinesh', 'rakesh', 'umesh', 'nitin', 'sachin', 'saurabh', 'gaurav', 'vivek', 'abhishek', 'akash', 'vishal', 'varun', 'tarun', 'karan', 'rohan', 'siddharth', 'harsha', 'pavan', 'chaitanya', 'srikanth', 'raghu', 'raghav', 'madhav', 'keshav', 'pranav', 'tejas', 'yash', 'dhruv', 'ishaan', 'aarav', 'vihaan', 'reyansh', 'anirudh', 'shreyas', 'sumanth', 'hemanth', 'prashanth', 'vasanth', 'jayanth', 'bharath', 'lokesh', 'kamal', 'vimal', 'gopi', 'mani', 'bala', 'selvam', 'murugesan', 'arumugam', 'senthil', 'karthikeyan', 'saravanan', 'prabhu', 'ilango', 'anbu', 'tamil', 'vel', 'subbu', 'raju', 'babu', 'krishnan', 'gopal', 'shyam', 'mohan', 'sohan', 'manish', 'ankit', 'ankur', 'piyush', 'kunal', 'sumit', 'puneet', 'mayank', 'shubham', 'ritesh', 'hitesh', 'jignesh', 'bhavesh', 'paresh', 'nilesh', 'mitesh', 'chirag', 'hardik', 'parth', 'dhaval', 'ketan', 'jatin', 'lalit', 'sunny', 'bobby', 'happy', 'lucky', 'pinky', 'sonu', 'monu', 'chintu', 'bunty', 'sweety', 'priyanka', 'deepika', 'shruti', 'shweta', 'swati', 'nidhi', 'ritu', 'rekha', 'radha', 'sita', 'gita', 'usha', 'asha', 'nisha', 'disha', 'isha', 'tanvi', 'kritika', 'aishwarya', 'bhavana', 'harini', 'keerthi', 'sowmya', 'ramya', 'divyasri', 'sravani', 'manasa', 'sahithi', 'lavanya', 'madhuri', 'padma', 'saraswathi', 'vani', 'jyothi', 'sushma', 'archana', 'aparna', 'anusha', 'pallavi', 'shilpa', 'roopa', 'deepa', 'sudha', 'latha', 'hema', 'uma', 'kamala', 'vimala', 'nirmala', 'savitri', 'parvathi', 'meenakshi', 'kalyani', 'revathi', 'gayathri', 'chitra', 'mythili', 'nandini', 'vaishnavi', 'sanjana', 'ananya', 'aditi', 'kavya', 'riya', 'sana', 'zara', 'zoya', 'nazia', 'shabana', 'rukhsar', 'salma', 'yasmin', 'ahmed', 'ali', 'hussain', 'hassan', 'rizwan', 'salman', 'faisal', 'asif', 'arif', 'javed', 'nadeem', 'wasim', 'shahid', 'rafiq', 'tariq', 'zubair', 'yusuf', 'ibrahim', 'ismail', 'mustafa', 'anwar', 'akbar', 'aslam', 'iqbal', 'john', 'peter', 'paul', 'james', 'george', 'francis', 'xavier', 'antony', 'anthony', 'michael', 'david', 'daniel', 'samuel', 'stephen', 'jacob', 'mathew', 'philip', 'sebastian', 'jose', 'maria', 'teresa', 'grace', 'elizabeth', 'jessica', 'rachel', 'manpreet', 'jaspreet', 'navjot', 'simran', 'baljeet', 'gurmeet', 'harjeet', 'kuldeep', 'jagdeep', 'amandeep', 'sukhwinder', 'balwinder', 'parminder', 'satnam', 'arjit', 'sourav', 'subhash', 'debashish', 'partha', 'sudip', 'anirban', 'arnab', 'abhijit', 'tanmoy', 'sayan', 'rupa', 'mousumi', 'moumita', 'payel', 'sudeshna', 'ankita', 'tanushree', 'joydeep', 'biswajit', 'pradeep', 'sudeep', 'kuldip', 'rajiv', 'sanjiv', 'vinod', 'pramod', 'ashwin', 'ashwini', 'manjunath', 'basavaraj', 'mallikarjun', 'shivakumar', 'nagesh', 'ramesha', 'siddappa', 'thimmappa', 'raghavendra', 'gurudatt', 'sudarshan', 'narasimha', 'anand', 'aravind', 'govind', 'mukund', 'sharad', 'milind', 'swapnil', 'sagar', 'tushar', 'omkar', 'aniket', 'prathamesh', 'sayali', 'snehal', 'rutuja', 'mrunal', 'ketaki', 'krishna', 'durga', 'narayana', 'lakshmana', 'rama', 'ram', 'gopala', 'shiva', 'shiv', 'jaya', 'vijaya', 'padmavathi', 'saraswati', 'kalpana', 'sapna', 'shanti', 'navya', 'raj', 'ganapathi', 'murugan', 'venkateswara', 'hanumantha', 'mahalakshmi', 'annapurna', 'amba', 'ambika', 'kamakshi', 'radhe', 'balakrishna', 'ramakrishna', 'gopalakrishna', 'satyanarayana', 'suryanarayana', 'lakshminarayana', 'nagendra', 'mahendra', 'surendra', 'rajendra', 'jitendra', 'devendra', 'narendra', 'upendra', 'virendra', 'yogendra'];
const LAST_NAMES = ['sharma', 'verma', 'gupta', 'singh', 'kumar', 'reddy', 'rao', 'naidu', 'nair', 'menon', 'pillai', 'iyer', 'iyengar', 'patel', 'shah', 'mehta', 'joshi', 'kulkarni', 'deshpande', 'patil', 'chopra', 'kapoor', 'khan', 'shaikh', 'ansari', 'das', 'banerjee', 'chatterjee', 'mukherjee', 'ghosh', 'bose', 'yadav', 'mishra', 'pandey', 'tiwari', 'agarwal', 'jain', 'goyal', 'thomas', 'fernandes', 'dsouza', 'babu', 'prasad', 'murthy', 'hegde', 'shetty', 'gowda', 'sai', 'krishnan', 'subramanian', 'deshmukh', 'venkatesh', 'chowdary', 'choudhary', 'chaudhary', 'varma', 'raju', 'setty', 'shastri', 'bhat', 'kamath', 'pai', 'nayak', 'naik', 'kini', 'acharya', 'saxena', 'srivastava', 'tripathi', 'dubey', 'dwivedi', 'chaturvedi', 'trivedi', 'upadhyay', 'bhatt', 'pathak', 'thakur', 'rathore', 'chauhan', 'rajput', 'sisodia', 'malhotra', 'khanna', 'arora', 'bhatia', 'sethi', 'kohli', 'sandhu', 'gill', 'dhillon', 'grewal', 'sidhu', 'bajwa', 'mann', 'bedi', 'ahuja', 'bansal', 'mittal', 'garg', 'singhal', 'goel', 'jindal', 'aggarwal', 'kansal', 'maheshwari', 'khandelwal', 'modi', 'desai', 'parikh', 'trivedi', 'vyas', 'pandya', 'dave', 'thakkar', 'chokshi', 'gandhi', 'sinha', 'jha', 'thakur', 'paswan', 'mondal', 'mandal', 'sarkar', 'roy', 'dutta', 'sen', 'saha', 'paul', 'biswas', 'pal', 'hazra', 'majumdar', 'bhattacharya', 'ganguly', 'chakraborty', 'naskar', 'mahato', 'behera', 'mohanty', 'panda', 'mishra', 'sahoo', 'pradhan', 'swain', 'nayak', 'jena', 'rout', 'barik', 'hussain', 'ahmed', 'ali', 'siddiqui', 'qureshi', 'mirza', 'baig', 'pathan', 'syed', 'sheikh', 'rizvi', 'naqvi', 'abbas', 'george', 'joseph', 'mathew', 'varghese', 'kurian', 'abraham', 'jacob', 'philip', 'cherian', 'chacko', 'antony', 'dcosta', 'pereira', 'rodrigues', 'pinto', 'lobo', 'gomes', 'nadar', 'thevar', 'mudaliar', 'chettiar', 'gounder', 'pandian', 'raman', 'ramanathan', 'balasubramanian', 'natarajan', 'sundaram', 'rajan', 'raghavan', 'srinivasan', 'venkataraman', 'swamy', 'kumari', 'devi', 'bai', 'begum', 'kaur'];

const HANDLES = ['ybl', 'okaxis', 'oksbi', 'okhdfcbank', 'okicici', 'paytm', 'ibl', 'axl', 'upi', 'apl', 'yapl', 'icici', 'sbi', 'hdfcbank', 'axisbank', 'kotak', 'fbl', 'jupiteraxis', 'waaxis'];
const TITLES = ['mr', 'mrs', 'ms', 'smt', 'shri', 'sri', 'kumari', 'dr', 'md', 'syed', 'sk', 'mohd'];

const PERSON_PRIOR = 0.4;
const UNKNOWN_PRIOR = 0.1;

let seed = 42;
function random(): number {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)];

function splitNames(names: readonly string[]): [string[], string[]] {
  const unique = [...new Set(names)];
  return [unique.filter((_, i) => i % 6 !== 5), unique.filter((_, i) => i % 6 === 5)];
}
const [TRAIN_FIRST, TEST_FIRST] = splitNames(FIRST_NAMES);
const [TRAIN_LAST, TEST_LAST] = splitNames(LAST_NAMES);

function caseLike(text: string): string {
  const roll = random();
  return roll < 0.55 ? text.toUpperCase() : roll < 0.9 ? text.replace(/\b\w/g, ch => ch.toUpperCase()) : text;
}

function business(name: string): string {
  if (random() < 0.12) {
    return `${name.replace(/[^a-z0-9]/g, '')}@${pick(HANDLES)}`;
  }
  return caseLike(`${name}${pick(SUFFIXES)}`);
}

function person(first: readonly string[], last: readonly string[]): string {
  const f = pick(first);
  const l = pick(last);
  const other = pick(first);
  if (random() < 0.15) {
    const id = pick([`${f}${l}`, `${f}.${l}`, `${f}${l[0]}`, `${f}${Math.floor(random() * 1000)}`, `${l}${f}`, f]);
    return `${id}@${pick(HANDLES)}`;
  }
  const name = pick([
    `${f} ${l}`,
    `${f} ${l}`,
    `${f} ${l}`,
    `${l} ${f}`,
    `${l[0]} ${f}`,
    `${f} ${l[0]}`,
    `${f[0]} ${other[0]} ${l}`,
    `${f} ${other} ${l}`,
    `${f} kumar ${l}`,
    `${f} ${pick(last)} ${l}`,
    `${pick(TITLES)} ${f} ${l}`,
    `${pick(TITLES)} ${f}`,
    f,
    `${f} ${other}`,
  ]);
  return caseLike(name);
}

function businessPrefix(first: readonly string[], last: readonly string[]): string {
  const roll = random();
  return roll < 0.6 ? pick(PREFIXES) : roll < 0.8 ? pick(first) : pick(last);
}

/** Labelled rows; people and name-prefixed shops use only the given names. */
function dataset(first: readonly string[], last: readonly string[]): [string, string][] {
  const rows: [string, string][] = [];
  for (const [category, brands] of Object.entries(BRANDS)) {
    for (const brand of brands) {
      for (let i = 0; i < 4; i++) {
        rows.push([business(brand), category]);
      }
    }
  }
  for (const [category, keywords] of Object.entries(KEYWORDS)) {
    for (let i = 0; i < 300; i++) {
      const name = random() < 0.85 ? `${businessPrefix(first, last)} ${pick(keywords)}` : pick(keywords);
      rows.push([business(name), category]);
    }
  }
  for (const bank of [...BANKS, ...GATEWAYS]) {
    for (let i = 0; i < 4; i++) {
      rows.push([business(bank), UNKNOWN]);
    }
  }
  for (let i = 0; i < 1200; i++) {
    rows.push([business(`${businessPrefix(first, last)} ${pick(VAGUE)}`), UNKNOWN]);
  }
  for (let i = 0; i < 7000; i++) {
    rows.push([person(first, last), PERSON]);
  }
  return rows;
}

interface Model {
  classes: string[];
  logPriors: number[];
  features: Record<string, number[]>;
}

function train(rows: [string, string][]): Model {
  const classes = [...new Set(rows.map(([, label]) => label))].sort();
  const featureTotals = classes.map(() => 0);
  const counts = new Map<string, number[]>();
  const documentFrequency = new Map<string, number>();
  for (const [text, label] of rows) {
    const c = classes.indexOf(label);
    for (const feature of payeeFeatures(text).flat()) {
      documentFrequency.set(feature, (documentFrequency.get(feature) ?? 0) + 1);
      const perClass = counts.get(feature) ?? classes.map(() => 0);
      perClass[c] += 1;
      featureTotals[c] += 1;
      counts.set(feature, perClass);
    }
  }
  const vocabulary = [...counts.keys()].filter(feature => (documentFrequency.get(feature) ?? 0) >= 3);
  const alpha = 0.5;
  const features: Record<string, number[]> = {};
  for (const feature of vocabulary) {
    const perClass = counts.get(feature)!;
    const weights = perClass.map((count, c) =>
      Math.log((count + alpha) / (featureTotals[c] + alpha * vocabulary.length)),
    );
    // Features that barely differ between classes only add noise and size.
    if (Math.max(...weights) - Math.min(...weights) >= 1) {
      features[feature] = weights.map(w => Math.round(w * 10) / 10);
    }
  }
  // Fixed odds rather than row counts, which only reflect how much data was generated.
  const categories = classes.filter(name => name !== PERSON && name !== UNKNOWN).length;
  const logPriors = classes.map(name => {
    const prior = name === PERSON ? PERSON_PRIOR : name === UNKNOWN ? UNKNOWN_PRIOR : (1 - PERSON_PRIOR - UNKNOWN_PRIOR) / categories;
    return Math.round(Math.log(prior) * 100) / 100;
  });
  return { classes, logPriors, features };
}

const decide = (model: Model, text: string) =>
  decidePayee(text, model.classes, scorePayee(text, model.logPriors, model.features));

function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

// Evaluate a model trained without some names, then ship one trained on all of them.
const rows = shuffle(dataset(TRAIN_FIRST, TRAIN_LAST));
const split = Math.floor(rows.length * 0.85);
const trial = train(rows.slice(0, split));
const businesses = rows.slice(split).filter(([, label]) => label !== PERSON);
const unseenPeople = Array.from({ length: 1000 }, () => person(TEST_FIRST, TEST_LAST));
const verbose = process.argv.includes('--verbose');

let peopleFound = 0;
for (const text of unseenPeople) {
  if (decide(trial, text).person) {
    peopleFound += 1;
  } else if (verbose) {
    console.log(`  person missed: ${text}`);
  }
}
let asPerson = 0;
let categorised = 0;
let correct = 0;
let vagueCategorised = 0;
for (const [text, label] of businesses) {
  const { person: isPerson, category } = decide(trial, text);
  if (isPerson) {
    asPerson += 1;
    if (verbose) console.log(`  business taken as person: ${text} (${label})`);
  } else if (category && label !== UNKNOWN) {
    categorised += 1;
    correct += category === label ? 1 : 0;
    if (verbose && category !== label) console.log(`  wrong: ${text} -> ${category} (${label})`);
  } else if (category) {
    vagueCategorised += 1;
  }
}
const known = businesses.filter(([, label]) => label !== UNKNOWN).length;
const pct = (n: number, d: number) => `${((n / d) * 100).toFixed(1)}%`;
console.log(`examples: ${rows.length}`);
console.log(`unseen people recognised: ${pct(peopleFound, unseenPeople.length)} (rest go to Other)`);
console.log(`held-out businesses taken as people: ${asPerson} of ${businesses.length}`);
console.log(
  `shops categorised: ${pct(categorised, known)}, correct ${pct(correct, categorised)} (rest go to Other); vague names/banks given a category: ${vagueCategorised}`,
);

const allRows = dataset(FIRST_NAMES, LAST_NAMES);
const model = train(allRows);
const json = JSON.stringify(model);
writeFileSync(new URL('../src/domain/categories/payeeModel.json', import.meta.url), `${json}\n`);
console.log(`features: ${Object.keys(model.features).length}, model size: ${(json.length / 1024).toFixed(0)} KB`);
