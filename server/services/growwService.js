import axios from 'axios'
import YahooFinance from 'yahoo-finance2'

// yahoo-finance2 v2 exports a class — instantiate once
const yahooFinance = new YahooFinance()

const GROWW_TOKEN = process.env.GROWW_API_KEY

// Mapping: TradeArena symbol → Yahoo Finance ticker
const SYMBOL_TO_YAHOO = {
  RELIANCE: 'RELIANCE.NS',
  TCS: 'TCS.NS',
  INFY: 'INFY.NS',
  HDFCBANK: 'HDFCBANK.NS',
  ICICIBANK: 'ICICIBANK.NS',
  WIPRO: 'WIPRO.NS',
  BAJFINANCE: 'BAJFINANCE.NS',
  AXISBANK: 'AXISBANK.NS',
  KOTAKBANK: 'KOTAKBANK.NS',
  SBIN: 'SBIN.NS',
  LT: 'LT.NS',
  HINDUNILVR: 'HINDUNILVR.NS',
  MARUTI: 'MARUTI.NS',
  TITAN: 'TITAN.NS',
  ASIANPAINT: 'ASIANPAINT.NS',
  SUNPHARMA: 'SUNPHARMA.NS',
  TATAMOTORS: 'TATAMOTORS.NS',
  TATASTEEL: 'TATASTEEL.NS',
  ITC: 'ITC.NS',
  BHARTIARTL: 'BHARTIARTL.NS',
  NIFTY: '^NSEI',
  BANKNIFTY: '^NSEBANK',
  GOLD: 'GC=F',
  CRUDEOIL: 'CL=F',
  SILVER: 'SI=F',
  ONGC: 'ONGC.NS',
  POWERGRID: 'POWERGRID.NS',
  NTPC: 'NTPC.NS',
  ADANIENT: 'ADANIENT.NS',
  ADANIPORTS: 'ADANIPORTS.NS',
  HCLTECH: 'HCLTECH.NS',
  TECHM: 'TECHM.NS',
  ULTRACEMCO: 'ULTRACEMCO.NS',
  GRASIM: 'GRASIM.NS',
  JSWSTEEL: 'JSWSTEEL.NS',
  CIPLA: 'CIPLA.NS',
  DRREDDY: 'DRREDDY.NS',
  DIVISLAB: 'DIVISLAB.NS',
  NESTLEIND: 'NESTLEIND.NS',
  BRITANNIA: 'BRITANNIA.NS'
}

const INSTRUMENTS = [
  // Indices
  { symbol: 'NIFTY', name: 'NIFTY 50 Index', market: 'IN', exchange: 'NSE', type: 'index' },
  { symbol: 'BANKNIFTY', name: 'Bank Nifty Index', market: 'IN', exchange: 'NSE', type: 'index' },
  { symbol: 'NIFTYMIDCAP', name: 'Nifty Midcap 100', market: 'IN', exchange: 'NSE', type: 'index' },
  { symbol: 'SENSEX', name: 'BSE Sensex', market: 'IN', exchange: 'BSE', type: 'index' },
  // Commodities
  { symbol: 'GOLD', name: 'Gold Futures', market: 'IN', exchange: 'MCX', type: 'commodity' },
  { symbol: 'SILVER', name: 'Silver Futures', market: 'IN', exchange: 'MCX', type: 'commodity' },
  { symbol: 'CRUDEOIL', name: 'Crude Oil Futures', market: 'IN', exchange: 'MCX', type: 'commodity' },
  { symbol: 'NATURALGAS', name: 'Natural Gas Futures', market: 'IN', exchange: 'MCX', type: 'commodity' },
  // Nifty 50
  { symbol: 'RELIANCE', name: 'Reliance Industries', market: 'IN', exchange: 'NSE' },
  { symbol: 'TCS', name: 'Tata Consultancy Services', market: 'IN', exchange: 'NSE' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', market: 'IN', exchange: 'NSE' },
  { symbol: 'INFY', name: 'Infosys', market: 'IN', exchange: 'NSE' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank', market: 'IN', exchange: 'NSE' },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever', market: 'IN', exchange: 'NSE' },
  { symbol: 'ITC', name: 'ITC Limited', market: 'IN', exchange: 'NSE' },
  { symbol: 'SBIN', name: 'State Bank of India', market: 'IN', exchange: 'NSE' },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel', market: 'IN', exchange: 'NSE' },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank', market: 'IN', exchange: 'NSE' },
  { symbol: 'LT', name: 'Larsen & Toubro', market: 'IN', exchange: 'NSE' },
  { symbol: 'AXISBANK', name: 'Axis Bank', market: 'IN', exchange: 'NSE' },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance', market: 'IN', exchange: 'NSE' },
  { symbol: 'HCLTECH', name: 'HCL Technologies', market: 'IN', exchange: 'NSE' },
  { symbol: 'WIPRO', name: 'Wipro', market: 'IN', exchange: 'NSE' },
  { symbol: 'MARUTI', name: 'Maruti Suzuki', market: 'IN', exchange: 'NSE' },
  { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical', market: 'IN', exchange: 'NSE' },
  { symbol: 'TITAN', name: 'Titan Company', market: 'IN', exchange: 'NSE' },
  { symbol: 'ULTRACEMCO', name: 'UltraTech Cement', market: 'IN', exchange: 'NSE' },
  { symbol: 'ASIANPAINT', name: 'Asian Paints', market: 'IN', exchange: 'NSE' },
  { symbol: 'TATAMOTORS', name: 'Tata Motors', market: 'IN', exchange: 'NSE' },
  { symbol: 'TATASTEEL', name: 'Tata Steel', market: 'IN', exchange: 'NSE' },
  { symbol: 'ONGC', name: 'ONGC', market: 'IN', exchange: 'NSE' },
  { symbol: 'NTPC', name: 'NTPC Limited', market: 'IN', exchange: 'NSE' },
  { symbol: 'POWERGRID', name: 'Power Grid Corporation', market: 'IN', exchange: 'NSE' },
  { symbol: 'M&M', name: 'Mahindra & Mahindra', market: 'IN', exchange: 'NSE' },
  { symbol: 'GRASIM', name: 'Grasim Industries', market: 'IN', exchange: 'NSE' },
  { symbol: 'ADANIENT', name: 'Adani Enterprises', market: 'IN', exchange: 'NSE' },
  { symbol: 'ADANIPORTS', name: 'Adani Ports & SEZ', market: 'IN', exchange: 'NSE' },
  { symbol: 'JSWSTEEL', name: 'JSW Steel', market: 'IN', exchange: 'NSE' },
  { symbol: 'CIPLA', name: 'Cipla', market: 'IN', exchange: 'NSE' },
  { symbol: 'DRREDDY', name: "Dr Reddy's Laboratories", market: 'IN', exchange: 'NSE' },
  { symbol: 'DIVISLAB', name: "Divi's Laboratories", market: 'IN', exchange: 'NSE' },
  { symbol: 'NESTLEIND', name: 'Nestle India', market: 'IN', exchange: 'NSE' },
  { symbol: 'BRITANNIA', name: 'Britannia Industries', market: 'IN', exchange: 'NSE' },
  { symbol: 'EICHERMOT', name: 'Eicher Motors', market: 'IN', exchange: 'NSE' },
  { symbol: 'HEROMOTOCO', name: 'Hero MotoCorp', market: 'IN', exchange: 'NSE' },
  { symbol: 'BPCL', name: 'Bharat Petroleum', market: 'IN', exchange: 'NSE' },
  { symbol: 'TATACONSUM', name: 'Tata Consumer Products', market: 'IN', exchange: 'NSE' },
  { symbol: 'APOLLOHOSP', name: 'Apollo Hospitals', market: 'IN', exchange: 'NSE' },
  { symbol: 'TECHM', name: 'Tech Mahindra', market: 'IN', exchange: 'NSE' },
  // Nifty Next 50 / Midcap
  { symbol: 'BAJAJ-AUTO', name: 'Bajaj Auto', market: 'IN', exchange: 'NSE' },
  { symbol: 'BAJAJFINSV', name: 'Bajaj Finserv', market: 'IN', exchange: 'NSE' },
  { symbol: 'IOC', name: 'Indian Oil Corporation', market: 'IN', exchange: 'NSE' },
  { symbol: 'VEDL', name: 'Vedanta', market: 'IN', exchange: 'NSE' },
  { symbol: 'ZOMATO', name: 'Zomato', market: 'IN', exchange: 'NSE' },
  { symbol: 'NYKAA', name: 'FSN E-Commerce (Nykaa)', market: 'IN', exchange: 'NSE' },
  { symbol: 'PAYTM', name: 'One97 Communications (Paytm)', market: 'IN', exchange: 'NSE' },
  { symbol: 'POLICYBZR', name: 'PB Fintech (PolicyBazaar)', market: 'IN', exchange: 'NSE' },
  { symbol: 'DMART', name: 'Avenue Supermarts (DMart)', market: 'IN', exchange: 'NSE' },
  { symbol: 'HAVELLS', name: 'Havells India', market: 'IN', exchange: 'NSE' },
  { symbol: 'PIDILITIND', name: 'Pidilite Industries', market: 'IN', exchange: 'NSE' },
  { symbol: 'BERGEPAINT', name: 'Berger Paints', market: 'IN', exchange: 'NSE' },
  { symbol: 'COLPAL', name: 'Colgate-Palmolive India', market: 'IN', exchange: 'NSE' },
  { symbol: 'DABUR', name: 'Dabur India', market: 'IN', exchange: 'NSE' },
  { symbol: 'GODREJCP', name: 'Godrej Consumer Products', market: 'IN', exchange: 'NSE' },
  { symbol: 'MARICO', name: 'Marico', market: 'IN', exchange: 'NSE' },
  { symbol: 'EMAMILTD', name: 'Emami', market: 'IN', exchange: 'NSE' },
  { symbol: 'UBL', name: 'United Breweries', market: 'IN', exchange: 'NSE' },
  { symbol: 'MCDOWELL-N', name: 'United Spirits', market: 'IN', exchange: 'NSE' },
  { symbol: 'TATAPOWER', name: 'Tata Power', market: 'IN', exchange: 'NSE' },
  { symbol: 'ADANIGREEN', name: 'Adani Green Energy', market: 'IN', exchange: 'NSE' },
  { symbol: 'ADANITRANS', name: 'Adani Transmission', market: 'IN', exchange: 'NSE' },
  { symbol: 'ADANIWILMAR', name: 'Adani Wilmar', market: 'IN', exchange: 'NSE' },
  { symbol: 'HINDCOPPER', name: 'Hindustan Copper', market: 'IN', exchange: 'NSE' },
  { symbol: 'NMDC', name: 'NMDC', market: 'IN', exchange: 'NSE' },
  { symbol: 'COALINDIA', name: 'Coal India', market: 'IN', exchange: 'NSE' },
  { symbol: 'SAIL', name: 'Steel Authority of India', market: 'IN', exchange: 'NSE' },
  { symbol: 'NATIONALUM', name: 'National Aluminium', market: 'IN', exchange: 'NSE' },
  { symbol: 'HINDALCO', name: 'Hindalco Industries', market: 'IN', exchange: 'NSE' },
  { symbol: 'INDUSINDBK', name: 'IndusInd Bank', market: 'IN', exchange: 'NSE' },
  { symbol: 'FEDERALBNK', name: 'Federal Bank', market: 'IN', exchange: 'NSE' },
  { symbol: 'IDFCFIRSTB', name: 'IDFC First Bank', market: 'IN', exchange: 'NSE' },
  { symbol: 'BANDHANBNK', name: 'Bandhan Bank', market: 'IN', exchange: 'NSE' },
  { symbol: 'RBLBANK', name: 'RBL Bank', market: 'IN', exchange: 'NSE' },
  { symbol: 'PNB', name: 'Punjab National Bank', market: 'IN', exchange: 'NSE' },
  { symbol: 'BANKBARODA', name: 'Bank of Baroda', market: 'IN', exchange: 'NSE' },
  { symbol: 'CANBK', name: 'Canara Bank', market: 'IN', exchange: 'NSE' },
  { symbol: 'UNIONBANK', name: 'Union Bank of India', market: 'IN', exchange: 'NSE' },
  { symbol: 'LICHSGFIN', name: 'LIC Housing Finance', market: 'IN', exchange: 'NSE' },
  { symbol: 'HDFC', name: 'HDFC Limited', market: 'IN', exchange: 'NSE' },
  { symbol: 'HDFCLIFE', name: 'HDFC Life Insurance', market: 'IN', exchange: 'NSE' },
  { symbol: 'SBILIFE', name: 'SBI Life Insurance', market: 'IN', exchange: 'NSE' },
  { symbol: 'ICICIGI', name: 'ICICI Lombard', market: 'IN', exchange: 'NSE' },
  { symbol: 'ICICIPRULI', name: 'ICICI Prudential Life', market: 'IN', exchange: 'NSE' },
  { symbol: 'MUTHOOTFIN', name: 'Muthoot Finance', market: 'IN', exchange: 'NSE' },
  { symbol: 'CHOLAFIN', name: 'Cholamandalam Finance', market: 'IN', exchange: 'NSE' },
  { symbol: 'SHRIRAMFIN', name: 'Shriram Finance', market: 'IN', exchange: 'NSE' },
  { symbol: 'M&MFIN', name: 'M&M Financial Services', market: 'IN', exchange: 'NSE' },
  { symbol: 'RECLTD', name: 'REC Limited', market: 'IN', exchange: 'NSE' },
  { symbol: 'PFC', name: 'Power Finance Corporation', market: 'IN', exchange: 'NSE' },
  { symbol: 'IRFC', name: 'IRFC', market: 'IN', exchange: 'NSE' },
  { symbol: 'ZEEL', name: 'Zee Entertainment', market: 'IN', exchange: 'NSE' },
  { symbol: 'PVR', name: 'PVR Inox', market: 'IN', exchange: 'NSE' },
  { symbol: 'INOXWIND', name: 'Inox Wind', market: 'IN', exchange: 'NSE' },
  { symbol: 'TRENT', name: 'Trent', market: 'IN', exchange: 'NSE' },
  { symbol: 'SHOPERSTOP', name: 'Shoppers Stop', market: 'IN', exchange: 'NSE' },
  { symbol: 'ABFRL', name: 'Aditya Birla Fashion', market: 'IN', exchange: 'NSE' },
  { symbol: 'PAGEIND', name: 'Page Industries', market: 'IN', exchange: 'NSE' },
  { symbol: 'WHIRLPOOL', name: 'Whirlpool India', market: 'IN', exchange: 'NSE' },
  { symbol: 'VOLTAS', name: 'Voltas', market: 'IN', exchange: 'NSE' },
  { symbol: 'BLUESTARCO', name: 'Blue Star', market: 'IN', exchange: 'NSE' },
  { symbol: 'CROMPTON', name: 'Crompton Greaves Consumer', market: 'IN', exchange: 'NSE' },
  { symbol: 'ORIENTELEC', name: 'Orient Electric', market: 'IN', exchange: 'NSE' },
  { symbol: 'POLYCAB', name: 'Polycab India', market: 'IN', exchange: 'NSE' },
  { symbol: 'SUPREMEIND', name: 'Supreme Industries', market: 'IN', exchange: 'NSE' },
  { symbol: 'ASTRAL', name: 'Astral Poly Technik', market: 'IN', exchange: 'NSE' },
  { symbol: 'DIXON', name: 'Dixon Technologies', market: 'IN', exchange: 'NSE' },
  { symbol: 'AMBER', name: 'Amber Enterprises', market: 'IN', exchange: 'NSE' },
  { symbol: 'PERSISTENT', name: 'Persistent Systems', market: 'IN', exchange: 'NSE' },
  { symbol: 'COFORGE', name: 'Coforge', market: 'IN', exchange: 'NSE' },
  { symbol: 'MPHASIS', name: 'Mphasis', market: 'IN', exchange: 'NSE' },
  { symbol: 'LTIM', name: 'LTIMindtree', market: 'IN', exchange: 'NSE' },
  { symbol: 'LTTS', name: 'L&T Technology Services', market: 'IN', exchange: 'NSE' },
  { symbol: 'KPITTECH', name: 'KPIT Technologies', market: 'IN', exchange: 'NSE' },
  { symbol: 'TATAELXSI', name: 'Tata Elxsi', market: 'IN', exchange: 'NSE' },
  { symbol: 'RCOM', name: 'Reliance Communications', market: 'IN', exchange: 'NSE' },
  { symbol: 'IDEA', name: 'Vodafone Idea', market: 'IN', exchange: 'NSE' },
  { symbol: 'MTNL', name: 'MTNL', market: 'IN', exchange: 'NSE' },
  { symbol: 'IRCTC', name: 'IRCTC', market: 'IN', exchange: 'NSE' },
  { symbol: 'CONCOR', name: 'Container Corp of India', market: 'IN', exchange: 'NSE' },
  { symbol: 'GMRINFRA', name: 'GMR Airports', market: 'IN', exchange: 'NSE' },
  { symbol: 'INTERGLOBE', name: 'IndiGo (InterGlobe Aviation)', market: 'IN', exchange: 'NSE' },
  { symbol: 'SPICEJET', name: 'SpiceJet', market: 'IN', exchange: 'NSE' },
  { symbol: 'INDIGO', name: 'IndiGo', market: 'IN', exchange: 'NSE' },
  { symbol: 'BEL', name: 'Bharat Electronics', market: 'IN', exchange: 'NSE' },
  { symbol: 'HAL', name: 'Hindustan Aeronautics', market: 'IN', exchange: 'NSE' },
  { symbol: 'BHEL', name: 'Bharat Heavy Electricals', market: 'IN', exchange: 'NSE' },
  { symbol: 'BEML', name: 'BEML', market: 'IN', exchange: 'NSE' },
  { symbol: 'OFSS', name: 'Oracle Financial Services', market: 'IN', exchange: 'NSE' },
  { symbol: 'INFY', name: 'Infosys', market: 'IN', exchange: 'NSE' },
  { symbol: 'SUNPHARMA', name: 'Sun Pharma', market: 'IN', exchange: 'NSE' },
  { symbol: 'LUPIN', name: 'Lupin', market: 'IN', exchange: 'NSE' },
  { symbol: 'AUROPHARMA', name: 'Aurobindo Pharma', market: 'IN', exchange: 'NSE' },
  { symbol: 'TORNTPHARM', name: 'Torrent Pharmaceuticals', market: 'IN', exchange: 'NSE' },
  { symbol: 'ALKEM', name: 'Alkem Laboratories', market: 'IN', exchange: 'NSE' },
  { symbol: 'IPCALAB', name: 'IPCA Laboratories', market: 'IN', exchange: 'NSE' },
  { symbol: 'BIOCON', name: 'Biocon', market: 'IN', exchange: 'NSE' },
  { symbol: 'LAURUSLABS', name: 'Laurus Labs', market: 'IN', exchange: 'NSE' },
  { symbol: 'GLENMARK', name: 'Glenmark Pharmaceuticals', market: 'IN', exchange: 'NSE' },
  { symbol: 'NATCOPHARM', name: 'Natco Pharma', market: 'IN', exchange: 'NSE' },
  { symbol: 'GRANULES', name: 'Granules India', market: 'IN', exchange: 'NSE' },
  { symbol: 'SYNGENE', name: 'Syngene International', market: 'IN', exchange: 'NSE' },
  { symbol: 'FORTIS', name: 'Fortis Healthcare', market: 'IN', exchange: 'NSE' },
  { symbol: 'METROPOLIS', name: 'Metropolis Healthcare', market: 'IN', exchange: 'NSE' },
  { symbol: 'LALPATHLAB', name: 'Dr Lal PathLabs', market: 'IN', exchange: 'NSE' },
  { symbol: 'MAXHEALTH', name: 'Max Healthcare', market: 'IN', exchange: 'NSE' },
  { symbol: 'NAUKRI', name: 'Info Edge (Naukri)', market: 'IN', exchange: 'NSE' },
  { symbol: 'JUSTDIAL', name: 'Just Dial', market: 'IN', exchange: 'NSE' },
  { symbol: 'INDIAMART', name: 'IndiaMART InterMESH', market: 'IN', exchange: 'NSE' },
  { symbol: 'CARTRADE', name: 'CarTrade Tech', market: 'IN', exchange: 'NSE' },
  { symbol: 'EASEMYTRIP', name: 'Easy Trip Planners', market: 'IN', exchange: 'NSE' },
  { symbol: 'DELHIVERY', name: 'Delhivery', market: 'IN', exchange: 'NSE' },
  { symbol: 'XPRO', name: 'Xpro India', market: 'IN', exchange: 'NSE' },
  { symbol: 'HFCL', name: 'HFCL', market: 'IN', exchange: 'NSE' },
  { symbol: 'RAILTEL', name: 'RailTel Corporation', market: 'IN', exchange: 'NSE' },
  { symbol: 'RITES', name: 'RITES', market: 'IN', exchange: 'NSE' },
  { symbol: 'NBCC', name: 'NBCC India', market: 'IN', exchange: 'NSE' },
  { symbol: 'HUDCO', name: 'HUDCO', market: 'IN', exchange: 'NSE' },
  { symbol: 'SJVN', name: 'SJVN', market: 'IN', exchange: 'NSE' },
  { symbol: 'NHPC', name: 'NHPC', market: 'IN', exchange: 'NSE' },
  { symbol: 'SUZLON', name: 'Suzlon Energy', market: 'IN', exchange: 'NSE' },
  { symbol: 'RPOWER', name: 'Reliance Power', market: 'IN', exchange: 'NSE' },
  { symbol: 'CESC', name: 'CESC', market: 'IN', exchange: 'NSE' },
  { symbol: 'TORNTPOWER', name: 'Torrent Power', market: 'IN', exchange: 'NSE' },
  { symbol: 'JSWENERGY', name: 'JSW Energy', market: 'IN', exchange: 'NSE' },
  { symbol: 'GREENPANEL', name: 'Greenpanel Industries', market: 'IN', exchange: 'NSE' },
  { symbol: 'CENTURYPLY', name: 'Century Plyboards', market: 'IN', exchange: 'NSE' },
  { symbol: 'KANSAINER', name: 'Kansai Nerolac Paints', market: 'IN', exchange: 'NSE' },
  { symbol: 'INDIGO', name: 'IndiGo Airlines', market: 'IN', exchange: 'NSE' },
  { symbol: 'TRIDENT', name: 'Trident', market: 'IN', exchange: 'NSE' },
  { symbol: 'WELCORP', name: 'Welspun Corp', market: 'IN', exchange: 'NSE' },
  { symbol: 'JINDALSTEL', name: 'Jindal Steel & Power', market: 'IN', exchange: 'NSE' },
  { symbol: 'HINDZINC', name: 'Hindustan Zinc', market: 'IN', exchange: 'NSE' },
  { symbol: 'MOIL', name: 'MOIL', market: 'IN', exchange: 'NSE' },
  { symbol: 'GMMPFAUDLR', name: 'GMM Pfaudler', market: 'IN', exchange: 'NSE' },
  { symbol: 'SCHAEFFLER', name: 'Schaeffler India', market: 'IN', exchange: 'NSE' },
  { symbol: 'BOSCHLTD', name: 'Bosch', market: 'IN', exchange: 'NSE' },
  { symbol: 'MOTHERSON', name: 'Samvardhana Motherson', market: 'IN', exchange: 'NSE' },
  { symbol: 'BHARATFORG', name: 'Bharat Forge', market: 'IN', exchange: 'NSE' },
  { symbol: 'SUNDRMFAST', name: 'Sundram Fasteners', market: 'IN', exchange: 'NSE' },
  { symbol: 'EXIDEIND', name: 'Exide Industries', market: 'IN', exchange: 'NSE' },
  { symbol: 'AMARARAJA', name: 'Amara Raja Batteries', market: 'IN', exchange: 'NSE' },
  { symbol: 'MRF', name: 'MRF', market: 'IN', exchange: 'NSE' },
  { symbol: 'APOLLOTYRE', name: 'Apollo Tyres', market: 'IN', exchange: 'NSE' },
  { symbol: 'BALKRISIND', name: 'Balkrishna Industries', market: 'IN', exchange: 'NSE' },
  { symbol: 'CEATLTD', name: 'CEAT', market: 'IN', exchange: 'NSE' },
  { symbol: 'TVSMOTORS', name: 'TVS Motor Company', market: 'IN', exchange: 'NSE' },
  { symbol: 'ASHOKLEY', name: 'Ashok Leyland', market: 'IN', exchange: 'NSE' },
  { symbol: 'TVSMOTOR', name: 'TVS Motor', market: 'IN', exchange: 'NSE' },
  { symbol: 'ESCORTS', name: 'Escorts Kubota', market: 'IN', exchange: 'NSE' },
  { symbol: 'FORCEMOT', name: 'Force Motors', market: 'IN', exchange: 'NSE' },
  { symbol: 'SRF', name: 'SRF', market: 'IN', exchange: 'NSE' },
  { symbol: 'DEEPAKNTR', name: 'Deepak Nitrite', market: 'IN', exchange: 'NSE' },
  { symbol: 'ALKYLAMINE', name: 'Alkyl Amines Chemicals', market: 'IN', exchange: 'NSE' },
  { symbol: 'CLEAN', name: 'Clean Science & Technology', market: 'IN', exchange: 'NSE' },
  { symbol: 'FINEORG', name: 'Fine Organic Industries', market: 'IN', exchange: 'NSE' },
  { symbol: 'NAVINFLUOR', name: 'Navin Fluorine', market: 'IN', exchange: 'NSE' },
  { symbol: 'TATACHEM', name: 'Tata Chemicals', market: 'IN', exchange: 'NSE' },
  { symbol: 'UPL', name: 'UPL', market: 'IN', exchange: 'NSE' },
  { symbol: 'PI', name: 'PI Industries', market: 'IN', exchange: 'NSE' },
  { symbol: 'RALLIS', name: 'Rallis India', market: 'IN', exchange: 'NSE' },
  { symbol: 'SUMICHEM', name: 'Sumitomo Chemical', market: 'IN', exchange: 'NSE' },
  { symbol: 'GHCL', name: 'GHCL', market: 'IN', exchange: 'NSE' },
  { symbol: 'SOLARA', name: 'Solara Active Pharma', market: 'IN', exchange: 'NSE' },
  { symbol: 'LICI', name: 'Life Insurance Corporation', market: 'IN', exchange: 'NSE' },
  { symbol: 'NIACL', name: 'New India Assurance', market: 'IN', exchange: 'NSE' },
  { symbol: 'GICRE', name: 'GIC Re', market: 'IN', exchange: 'NSE' },
  { symbol: 'STARHEALTH', name: 'Star Health Insurance', market: 'IN', exchange: 'NSE' },
  { symbol: 'CGCL', name: 'Capri Global Capital', market: 'IN', exchange: 'NSE' },
  { symbol: 'AAVAS', name: 'Aavas Financiers', market: 'IN', exchange: 'NSE' },
  { symbol: 'HOMEFIRST', name: 'Home First Finance', market: 'IN', exchange: 'NSE' },
  { symbol: 'APTUS', name: 'Aptus Value Housing', market: 'IN', exchange: 'NSE' },
]

// Suppress the yahoo-finance2 survey notice (method available on class, not instance)
try { YahooFinance.suppressNotices?.(['yahooSurvey']) } catch {/* ignore */}

// ── Yahoo Finance crumb / cookie management ──────────────────────────────────
let _crumb = null
let _cookies = null
let _crumbFetchedAt = 0
let _crumbFailCount = 0
let _crumbNextRetry = 0
const CRUMB_TTL = 55 * 60 * 1000 // re-fetch every 55 minutes

// Backoff schedule: [30s, 60s, 2min, 5min, 15min, 30min]
const CRUMB_BACKOFF = [30, 60, 120, 300, 900, 1800].map(s => s * 1000)

async function getYahooCrumb() {
  const now = Date.now()
  // Valid crumb — use it
  if (_crumb && (now - _crumbFetchedAt) < CRUMB_TTL) return { crumb: _crumb, cookies: _cookies }
  // Back off after repeated failures
  if (now < _crumbNextRetry) return null

  try {
    // Step 1: hit the consent/home page to get a session cookie
    const homeRes = await axios.get('https://finance.yahoo.com/', {
      timeout: 10000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    })
    const setCookieHeader = homeRes.headers['set-cookie'] ?? []
    const cookieStr = setCookieHeader.map(c => c.split(';')[0]).join('; ')

    // Step 2: get crumb
    const crumbRes = await axios.get('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/plain, */*',
        'Cookie': cookieStr,
      }
    })
    _crumb = crumbRes.data
    _cookies = cookieStr
    _crumbFetchedAt = now
    _crumbFailCount = 0
    _crumbNextRetry = 0
    console.log('[growwService] Yahoo crumb obtained successfully')
    return { crumb: _crumb, cookies: _cookies }
  } catch (err) {
    const delay = CRUMB_BACKOFF[Math.min(_crumbFailCount, CRUMB_BACKOFF.length - 1)]
    _crumbNextRetry = now + delay
    _crumbFailCount++
    // Only log first failure and then once after each long backoff period
    if (_crumbFailCount <= 1 || delay >= 300000) {
      console.warn(`[growwService] Yahoo crumb unavailable (${err.message}), retrying in ${delay/1000}s — using v8 fallback`)
    }
    return null
  }
}

// Fetch via Yahoo Finance v8 HTTP API directly (no npm package quirks)
async function fetchYahooHTTP(yahooSymbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`
  const res = await axios.get(url, {
    timeout: 8000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'application/json'
    }
  })
  const meta = res.data?.chart?.result?.[0]?.meta
  if (!meta) throw new Error(`No data for ${yahooSymbol}`)
  const price = meta.regularMarketPrice ?? meta.chartPreviousClose ?? 0
  const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? price
  return {
    price,
    change: price - prevClose,
    changePercent: prevClose ? ((price - prevClose) / prevClose) * 100 : 0,
    high: meta.regularMarketDayHigh ?? price,
    low: meta.regularMarketDayLow ?? price,
    volume: meta.regularMarketVolume ?? 0,
    open: meta.regularMarketOpen ?? price,
    prevClose
  }
}

// Fallback: yahoo-finance2 npm package
async function fetchYahooPackage(yahooSymbol) {
  const q = await yahooFinance.quote(yahooSymbol)
  if (!q) throw new Error(`No data from yahoo-finance2 for ${yahooSymbol}`)
  const price = q.regularMarketPrice ?? 0
  const prevClose = q.regularMarketPreviousClose ?? price
  return {
    price,
    change: q.regularMarketChange ?? (price - prevClose),
    changePercent: q.regularMarketChangePercent ?? 0,
    high: q.regularMarketDayHigh ?? price,
    low: q.regularMarketDayLow ?? price,
    volume: q.regularMarketVolume ?? 0,
    open: q.regularMarketOpen ?? price,
    prevClose
  }
}

async function fetchYahooQuote(symbol) {
  const yahooKey = SYMBOL_TO_YAHOO[symbol] ?? `${symbol}.NS`
  try {
    return await fetchYahooHTTP(yahooKey)
  } catch {
    return await fetchYahooPackage(yahooKey)
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

// Batched Yahoo Finance: try v7 with crumb first, fall back to staggered v8 per-symbol
export async function fetchIndianQuotes(symbols) {
  if (!symbols || symbols.length === 0) return {}

  // Build ticker → symbol reverse map
  const tickerToSymbol = {}
  const tickers = symbols.map(s => {
    const ticker = SYMBOL_TO_YAHOO[s] ?? `${s}.NS`
    tickerToSymbol[ticker] = s
    return ticker
  })

  const result = {}

  // ── Attempt 1: crumb-authenticated v7 batch (single request) ────────────
  const auth = await getYahooCrumb()
  if (auth) {
    try {
      const { data } = await axios.get('https://query1.finance.yahoo.com/v7/finance/quote', {
        params: {
          symbols: tickers.join(','),
          crumb: auth.crumb,
          fields: [
            'regularMarketPrice', 'regularMarketChange', 'regularMarketChangePercent',
            'regularMarketDayHigh', 'regularMarketDayLow', 'regularMarketVolume',
            'regularMarketOpen', 'regularMarketPreviousClose'
          ].join(',')
        },
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cookie': auth.cookies,
        }
      })

      const quotes = data?.quoteResponse?.result ?? []
      for (const q of quotes) {
        const sym = tickerToSymbol[q.symbol]
        if (!sym) continue
        const price = q.regularMarketPrice ?? 0
        const prevClose = q.regularMarketPreviousClose ?? price
        result[sym] = {
          price,
          change: q.regularMarketChange ?? (price - prevClose),
          changePercent: q.regularMarketChangePercent ?? 0,
          high: q.regularMarketDayHigh ?? price,
          low: q.regularMarketDayLow ?? price,
          volume: q.regularMarketVolume ?? 0,
          open: q.regularMarketOpen ?? price,
          prevClose
        }
      }

      if (Object.keys(result).length > 0) {
        return result // ✓ all done in one request
      }
    } catch (err) {
      if (err.response?.status === 429 || err.response?.status === 401) {
        // Crumb stale — force re-fetch next time
        _crumb = null; _cookies = null; _crumbFetchedAt = 0
      }
      console.warn(`[growwService] v7 batch failed (${err.message}), trying staggered v8`)
    }
  }

  // ── Attempt 2: staggered v8 chart API, 200 ms between each symbol ────────
  for (let i = 0; i < symbols.length; i++) {
    try {
      result[symbols[i]] = await fetchYahooQuote(symbols[i])
    } catch { /* silent */ }
    if (i < symbols.length - 1) await sleep(200) // avoid burst
  }

  return result
}

export function getYahooKey(symbol) {
  return SYMBOL_TO_YAHOO[symbol] ?? `${symbol}.NS`
}

// Deduplicated instruments list (by symbol)
const UNIQUE_INSTRUMENTS = Array.from(
  new Map(INSTRUMENTS.map(i => [i.symbol, i])).values()
)

export function searchSymbols(query) {
  if (!query || query.length < 1) return []
  const q = query.toLowerCase()
  return UNIQUE_INSTRUMENTS.filter(
    inst =>
      inst.symbol.toLowerCase().includes(q) ||
      inst.name.toLowerCase().includes(q)
  ).slice(0, 20)
}

export function getInstruments() {
  return UNIQUE_INSTRUMENTS
}
