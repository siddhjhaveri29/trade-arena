/**
 * instrumentsCache.js
 * Loads ALL Indian stocks from NSE's official equity CSV on startup.
 * Loads ALL US stocks from Alpaca assets API (or a large static fallback).
 * Used by the /api/search endpoint for full symbol search.
 */

import https from 'https'
import axios from 'axios'
import { parse } from 'csv-parse/sync'

let indianInstruments = []
let usInstruments = []
let loaded = false

// Helper: fetch via native https (handles BSE's malformed headers)
function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      insecureHTTPParser: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        ...headers
      }
    }, (res) => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString()))
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')) })
  })
}

// ─── Indian stocks: NSE + BSE ────────────────────────────────────────────────

async function loadNSEInstruments() {
  const res = await axios.get(
    'https://archives.nseindia.com/content/equities/EQUITY_L.csv',
    { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/csv,*/*' } }
  )
  const records = parse(res.data, { columns: true, skip_empty_lines: true, trim: true })
  return records
    .filter(r => r['SERIES'] === 'EQ' || !r['SERIES'])
    .map(r => ({
      symbol: r['SYMBOL']?.trim().toUpperCase(),
      name: r['NAME OF COMPANY']?.trim() || r['SYMBOL'],
      isin: r['ISIN NUMBER']?.trim(),
      market: 'IN',
      exchange: 'NSE',
      yahooKey: `${r['SYMBOL']?.trim().toUpperCase()}.NS`
    }))
    .filter(r => r.symbol)
}

async function loadBSEInstruments() {
  const body = await httpsGet(
    'https://api.bseindia.com/BseIndiaAPI/api/ListofScripData/w?segment=Equity&status=Active&globalvar=&scripcode=&industry=&group=',
    { 'Origin': 'https://www.bseindia.com', 'Referer': 'https://www.bseindia.com/' }
  )
  const stocks = JSON.parse(body)
  return stocks
    .filter(s => s.Status === 'Active' && s.scrip_id && s.SCRIP_CD)
    .map(s => ({
      symbol: s.scrip_id.trim().toUpperCase(),
      name: s.Scrip_Name?.trim() || s.Issuer_Name?.trim() || s.scrip_id,
      isin: s.ISIN_NUMBER?.trim(),
      scripCode: s.SCRIP_CD,
      market: 'IN',
      exchange: 'BSE',
      yahooKey: `${s.SCRIP_CD}.BO`,
      group: s.GROUP
    }))
}

async function loadAllIndianInstruments() {
  try {
    console.log('[instrumentsCache] Loading NSE + BSE equity lists...')

    const [nseStocks, bseStocks] = await Promise.allSettled([
      loadNSEInstruments(),
      loadBSEInstruments()
    ])

    const nse = nseStocks.status === 'fulfilled' ? nseStocks.value : []
    const bse = bseStocks.status === 'fulfilled' ? bseStocks.value : []

    if (nseStocks.status === 'rejected') console.warn('[instrumentsCache] NSE load failed:', nseStocks.reason?.message)
    if (bseStocks.status === 'rejected') console.warn('[instrumentsCache] BSE load failed:', bseStocks.reason?.message)

    // Build ISIN → NSE symbol map so we can skip BSE duplicates
    const nseIsinSet = new Set(nse.map(s => s.isin).filter(Boolean))
    const nseSymbolSet = new Set(nse.map(s => s.symbol))

    // BSE-only stocks: not already in NSE by ISIN or symbol
    const bseOnly = bse.filter(s =>
      s.isin && !nseIsinSet.has(s.isin) && !nseSymbolSet.has(s.symbol)
    )

    // Also mark NSE stocks that have BSE scrip codes (for TradingView BSE chart option)
    const isinToScripCode = {}
    bse.forEach(s => { if (s.isin) isinToScripCode[s.isin] = s.scripCode })
    const nseWithBSE = nse.map(s => ({
      ...s,
      bseScripCode: isinToScripCode[s.isin] || null
    }))

    const specials = [
      { symbol: 'NIFTY',      name: 'NIFTY 50 Index',        market: 'IN', exchange: 'NSE', type: 'index',     yahooKey: '^NSEI' },
      { symbol: 'BANKNIFTY',  name: 'Bank Nifty Index',       market: 'IN', exchange: 'NSE', type: 'index',     yahooKey: '^NSEBANK' },
      { symbol: 'SENSEX',     name: 'BSE Sensex',             market: 'IN', exchange: 'BSE', type: 'index',     yahooKey: '^BSESN' },
      { symbol: 'NIFTYMIDCAP',name: 'Nifty Midcap 100',       market: 'IN', exchange: 'NSE', type: 'index',     yahooKey: '^NSEMDCP100' },
      { symbol: 'GOLD',       name: 'Gold Futures (MCX)',      market: 'IN', exchange: 'MCX', type: 'commodity', yahooKey: 'GC=F' },
      { symbol: 'SILVER',     name: 'Silver Futures (MCX)',    market: 'IN', exchange: 'MCX', type: 'commodity', yahooKey: 'SI=F' },
      { symbol: 'CRUDEOIL',   name: 'Crude Oil Futures (MCX)', market: 'IN', exchange: 'MCX', type: 'commodity', yahooKey: 'CL=F' },
      { symbol: 'NATURALGAS', name: 'Natural Gas (MCX)',       market: 'IN', exchange: 'MCX', type: 'commodity', yahooKey: 'NG=F' },
    ]

    indianInstruments = [...specials, ...nseWithBSE, ...bseOnly]
    console.log(`[instrumentsCache] Loaded ${nse.length} NSE + ${bseOnly.length} BSE-only = ${indianInstruments.length} total Indian instruments`)
  } catch (err) {
    console.warn('[instrumentsCache] Indian instruments load failed, using fallback:', err.message)
    indianInstruments = getFallbackIndian()
  }
}

// ─── US stocks: Alpaca assets API ───────────────────────────────────────────

async function loadUSInstruments() {
  if (!process.env.ALPACA_KEY_ID) {
    usInstruments = getLargeUSFallback()
    console.log(`[instrumentsCache] No Alpaca key — using ${usInstruments.length} US fallback instruments`)
    return
  }

  try {
    console.log('[instrumentsCache] Loading US assets from Alpaca...')
    const res = await axios.get(`${process.env.ALPACA_BASE_URL ?? 'https://paper-api.alpaca.markets'}/v2/assets`, {
      params: { status: 'active', asset_class: 'us_equity' },
      headers: {
        'APCA-API-KEY-ID': process.env.ALPACA_KEY_ID,
        'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY
      },
      timeout: 20000
    })

    usInstruments = res.data
      .filter(a => a.tradable && a.symbol && a.name)
      .map(a => ({
        symbol: a.symbol,
        name: a.name,
        market: 'US',
        exchange: a.exchange,
        yahooKey: a.symbol
      }))

    console.log(`[instrumentsCache] Loaded ${usInstruments.length} US instruments from Alpaca`)
  } catch (err) {
    console.warn('[instrumentsCache] Alpaca asset load failed, using fallback:', err.message)
    usInstruments = getLargeUSFallback()
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function init() {
  await Promise.allSettled([loadAllIndianInstruments(), loadUSInstruments()])
  loaded = true
}

export function searchIndian(query) {
  if (!query) return []
  const q = query.toLowerCase()
  return indianInstruments
    .filter(i => i.symbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q))
    .slice(0, 25)
}

export function searchUS(query) {
  if (!query) return []
  const q = query.toLowerCase()
  return usInstruments
    .filter(i => i.symbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q))
    .slice(0, 25)
}

export function getIndianInstruments() { return indianInstruments }
export function getUSInstruments() { return usInstruments }
export function isLoaded() { return loaded }

// ─── Fallbacks ───────────────────────────────────────────────────────────────

function getFallbackIndian() {
  // Nifty 50 + common stocks as emergency fallback
  const stocks = [
    ['RELIANCE','Reliance Industries'],['TCS','Tata Consultancy Services'],
    ['HDFCBANK','HDFC Bank'],['INFY','Infosys'],['ICICIBANK','ICICI Bank'],
    ['HINDUNILVR','Hindustan Unilever'],['ITC','ITC Limited'],['SBIN','State Bank of India'],
    ['BHARTIARTL','Bharti Airtel'],['KOTAKBANK','Kotak Mahindra Bank'],
    ['LT','Larsen & Toubro'],['AXISBANK','Axis Bank'],['BAJFINANCE','Bajaj Finance'],
    ['HCLTECH','HCL Technologies'],['WIPRO','Wipro'],['MARUTI','Maruti Suzuki'],
    ['SUNPHARMA','Sun Pharmaceutical'],['TITAN','Titan Company'],
    ['ULTRACEMCO','UltraTech Cement'],['ASIANPAINT','Asian Paints'],
    ['TATAMOTORS','Tata Motors'],['TATASTEEL','Tata Steel'],['ONGC','ONGC'],
    ['NTPC','NTPC Limited'],['POWERGRID','Power Grid Corporation'],
    ['GRASIM','Grasim Industries'],['ADANIENT','Adani Enterprises'],
    ['ADANIPORTS','Adani Ports & SEZ'],['JSWSTEEL','JSW Steel'],
    ['CIPLA','Cipla'],['DRREDDY',"Dr Reddy's Laboratories"],
    ['DIVISLAB',"Divi's Laboratories"],['NESTLEIND','Nestle India'],
    ['BRITANNIA','Britannia Industries'],['EICHERMOT','Eicher Motors'],
    ['HEROMOTOCO','Hero MotoCorp'],['BPCL','Bharat Petroleum'],
    ['TATACONSUM','Tata Consumer Products'],['APOLLOHOSP','Apollo Hospitals'],
    ['TECHM','Tech Mahindra'],['BAJAJ-AUTO','Bajaj Auto'],
    ['BAJAJFINSV','Bajaj Finserv'],['IOC','Indian Oil Corporation'],
    ['ZOMATO','Zomato'],['NAUKRI','Info Edge (Naukri)'],['DMART','Avenue Supermarts'],
    ['HAVELLS','Havells India'],['PIDILITIND','Pidilite Industries'],
    ['COALINDIA','Coal India'],['HINDALCO','Hindalco Industries'],
    ['VEDL','Vedanta'],['INDUSINDBK','IndusInd Bank'],['M&M','Mahindra & Mahindra'],
    ['TATAPOWER','Tata Power'],['IRCTC','IRCTC'],['HAL','Hindustan Aeronautics'],
    ['BEL','Bharat Electronics'],['LICI','LIC India'],['HDFCLIFE','HDFC Life'],
    ['SBILIFE','SBI Life Insurance'],['PAYTM','Paytm'],['NYKAA','Nykaa'],
    ['LUPIN','Lupin'],['AUROPHARMA','Aurobindo Pharma'],['BIOCON','Biocon'],
    ['MRF','MRF'],['APOLLOTYRE','Apollo Tyres'],['ASHOKLEY','Ashok Leyland'],
    ['TVSMOTORS','TVS Motor'],['EXIDEIND','Exide Industries'],
    ['POLYCAB','Polycab India'],['DIXON','Dixon Technologies'],
    ['PERSISTENT','Persistent Systems'],['COFORGE','Coforge'],
    ['MPHASIS','Mphasis'],['LTIM','LTIMindtree'],
    ['RECLTD','REC Limited'],['PFC','Power Finance Corporation'],
    ['PNB','Punjab National Bank'],['BANKBARODA','Bank of Baroda'],
    ['CANBK','Canara Bank'],['FEDERALBNK','Federal Bank'],
    ['IDFCFIRSTB','IDFC First Bank'],['JINDALSTEL','Jindal Steel & Power'],
    ['HINDZINC','Hindustan Zinc'],['NMDC','NMDC'],['SAIL','SAIL'],
  ]
  const specials = [
    { symbol: 'NIFTY', name: 'NIFTY 50 Index', market: 'IN', exchange: 'NSE', type: 'index', yahooKey: '^NSEI' },
    { symbol: 'BANKNIFTY', name: 'Bank Nifty Index', market: 'IN', exchange: 'NSE', type: 'index', yahooKey: '^NSEBANK' },
    { symbol: 'GOLD', name: 'Gold Futures', market: 'IN', exchange: 'MCX', type: 'commodity', yahooKey: 'GC=F' },
    { symbol: 'SILVER', name: 'Silver Futures', market: 'IN', exchange: 'MCX', type: 'commodity', yahooKey: 'SI=F' },
    { symbol: 'CRUDEOIL', name: 'Crude Oil Futures', market: 'IN', exchange: 'MCX', type: 'commodity', yahooKey: 'CL=F' },
  ]
  return [...specials, ...stocks.map(([symbol, name]) => ({ symbol, name, market: 'IN', exchange: 'NSE', yahooKey: `${symbol}.NS` }))]
}

function getLargeUSFallback() {
  // S&P 500 + NASDAQ 100 most traded stocks
  const stocks = [
    ['AAPL','Apple Inc.','NASDAQ'],['MSFT','Microsoft Corporation','NASDAQ'],
    ['NVDA','NVIDIA Corporation','NASDAQ'],['AMZN','Amazon.com Inc.','NASDAQ'],
    ['GOOGL','Alphabet Inc. Class A','NASDAQ'],['GOOG','Alphabet Inc. Class C','NASDAQ'],
    ['META','Meta Platforms Inc.','NASDAQ'],['TSLA','Tesla Inc.','NASDAQ'],
    ['BRK.B','Berkshire Hathaway Class B','NYSE'],['UNH','UnitedHealth Group','NYSE'],
    ['LLY','Eli Lilly and Company','NYSE'],['JPM','JPMorgan Chase & Co.','NYSE'],
    ['XOM','Exxon Mobil Corporation','NYSE'],['V','Visa Inc.','NYSE'],
    ['MA','Mastercard Incorporated','NYSE'],['AVGO','Broadcom Inc.','NASDAQ'],
    ['PG','Procter & Gamble Co.','NYSE'],['JNJ','Johnson & Johnson','NYSE'],
    ['HD','Home Depot Inc.','NYSE'],['COST','Costco Wholesale Corporation','NASDAQ'],
    ['MRK','Merck & Co. Inc.','NYSE'],['ABBV','AbbVie Inc.','NYSE'],
    ['CVX','Chevron Corporation','NYSE'],['CRM','Salesforce Inc.','NYSE'],
    ['BAC','Bank of America Corporation','NYSE'],['NFLX','Netflix Inc.','NASDAQ'],
    ['AMD','Advanced Micro Devices','NASDAQ'],['KO','Coca-Cola Company','NYSE'],
    ['PEP','PepsiCo Inc.','NASDAQ'],['TMO','Thermo Fisher Scientific','NYSE'],
    ['WMT','Walmart Inc.','NYSE'],['MCD','McDonald\'s Corporation','NYSE'],
    ['ACN','Accenture plc','NYSE'],['CSCO','Cisco Systems Inc.','NASDAQ'],
    ['ABT','Abbott Laboratories','NYSE'],['CAT','Caterpillar Inc.','NYSE'],
    ['GE','General Electric Company','NYSE'],['TXN','Texas Instruments Inc.','NASDAQ'],
    ['NEE','NextEra Energy Inc.','NYSE'],['DHR','Danaher Corporation','NYSE'],
    ['LOW','Lowe\'s Companies Inc.','NYSE'],['INTU','Intuit Inc.','NASDAQ'],
    ['ISRG','Intuitive Surgical Inc.','NASDAQ'],['AMAT','Applied Materials Inc.','NASDAQ'],
    ['IBM','International Business Machines','NYSE'],['RTX','Raytheon Technologies','NYSE'],
    ['HON','Honeywell International','NASDAQ'],['AMGN','Amgen Inc.','NASDAQ'],
    ['QCOM','Qualcomm Inc.','NASDAQ'],['GS','Goldman Sachs Group','NYSE'],
    ['MS','Morgan Stanley','NYSE'],['WFC','Wells Fargo & Company','NYSE'],
    ['C','Citigroup Inc.','NYSE'],['SCHW','Charles Schwab Corporation','NYSE'],
    ['BLK','BlackRock Inc.','NYSE'],['AXP','American Express Company','NYSE'],
    ['SPGI','S&P Global Inc.','NYSE'],['CME','CME Group Inc.','NASDAQ'],
    ['PFE','Pfizer Inc.','NYSE'],['GILD','Gilead Sciences Inc.','NASDAQ'],
    ['BMY','Bristol-Myers Squibb','NYSE'],['AMGN','Amgen Inc.','NASDAQ'],
    ['REGN','Regeneron Pharmaceuticals','NASDAQ'],['VRTX','Vertex Pharmaceuticals','NASDAQ'],
    ['BSX','Boston Scientific Corporation','NYSE'],['MDT','Medtronic plc','NYSE'],
    ['SYK','Stryker Corporation','NYSE'],['ELV','Elevance Health Inc.','NYSE'],
    ['CVS','CVS Health Corporation','NYSE'],['CI','Cigna Group','NYSE'],
    ['HUM','Humana Inc.','NYSE'],['T','AT&T Inc.','NYSE'],
    ['VZ','Verizon Communications','NYSE'],['TMUS','T-Mobile US Inc.','NASDAQ'],
    ['CMCSA','Comcast Corporation','NASDAQ'],['DIS','Walt Disney Company','NYSE'],
    ['PARA','Paramount Global','NASDAQ'],['WBD','Warner Bros. Discovery','NASDAQ'],
    ['NFLX','Netflix Inc.','NASDAQ'],['SPOT','Spotify Technology','NYSE'],
    ['UBER','Uber Technologies Inc.','NYSE'],['LYFT','Lyft Inc.','NASDAQ'],
    ['ABNB','Airbnb Inc.','NASDAQ'],['BKNG','Booking Holdings Inc.','NASDAQ'],
    ['EXPE','Expedia Group Inc.','NASDAQ'],['MAR','Marriott International','NASDAQ'],
    ['HLT','Hilton Worldwide Holdings','NYSE'],['UAL','United Airlines Holdings','NASDAQ'],
    ['DAL','Delta Air Lines Inc.','NYSE'],['AAL','American Airlines Group','NASDAQ'],
    ['LUV','Southwest Airlines Co.','NYSE'],['BA','Boeing Company','NYSE'],
    ['LMT','Lockheed Martin Corporation','NYSE'],['GD','General Dynamics','NYSE'],
    ['NOC','Northrop Grumman Corporation','NYSE'],['RTX','Raytheon Technologies','NYSE'],
    ['DE','Deere & Company','NYSE'],['ADM','Archer-Daniels-Midland','NYSE'],
    ['MOS','Mosaic Company','NYSE'],['CF','CF Industries Holdings','NYSE'],
    ['NUE','Nucor Corporation','NYSE'],['FCX','Freeport-McMoRan Inc.','NYSE'],
    ['AA','Alcoa Corporation','NYSE'],['CLF','Cleveland-Cliffs Inc.','NYSE'],
    ['X','United States Steel Corporation','NYSE'],['MP','MP Materials Corp.','NYSE'],
    ['SLB','Schlumberger Limited','NYSE'],['HAL','Halliburton Company','NYSE'],
    ['BKR','Baker Hughes Company','NASDAQ'],['OXY','Occidental Petroleum','NYSE'],
    ['MPC','Marathon Petroleum Corporation','NYSE'],['PSX','Phillips 66','NYSE'],
    ['VLO','Valero Energy Corporation','NYSE'],['DVN','Devon Energy Corporation','NYSE'],
    ['PXD','Pioneer Natural Resources','NYSE'],['EOG','EOG Resources Inc.','NYSE'],
    ['COP','ConocoPhillips','NYSE'],['APA','APA Corporation','NASDAQ'],
    ['MU','Micron Technology Inc.','NASDAQ'],['INTC','Intel Corporation','NASDAQ'],
    ['KLAC','KLA Corporation','NASDAQ'],['LRCX','Lam Research Corporation','NASDAQ'],
    ['MRVL','Marvell Technology Inc.','NASDAQ'],['ON','ON Semiconductor','NASDAQ'],
    ['STX','Seagate Technology Holdings','NASDAQ'],['WDC','Western Digital Corporation','NASDAQ'],
    ['HPQ','HP Inc.','NYSE'],['HPE','Hewlett Packard Enterprise','NYSE'],
    ['DELL','Dell Technologies Inc.','NYSE'],['NTAP','NetApp Inc.','NASDAQ'],
    ['PSTG','Pure Storage Inc.','NYSE'],['SNOW','Snowflake Inc.','NYSE'],
    ['DDOG','Datadog Inc.','NASDAQ'],['MDB','MongoDB Inc.','NASDAQ'],
    ['CFLT','Confluent Inc.','NASDAQ'],['ESTC','Elastic N.V.','NYSE'],
    ['NET','Cloudflare Inc.','NYSE'],['ZS','Zscaler Inc.','NASDAQ'],
    ['CRWD','CrowdStrike Holdings','NASDAQ'],['S','SentinelOne Inc.','NYSE'],
    ['PANW','Palo Alto Networks','NASDAQ'],['FTNT','Fortinet Inc.','NASDAQ'],
    ['OKTA','Okta Inc.','NASDAQ'],['CYBR','CyberArk Software Ltd.','NASDAQ'],
    ['NOW','ServiceNow Inc.','NYSE'],['WDAY','Workday Inc.','NASDAQ'],
    ['VEEV','Veeva Systems Inc.','NYSE'],['HUBS','HubSpot Inc.','NYSE'],
    ['ZM','Zoom Video Communications','NASDAQ'],['DOCU','DocuSign Inc.','NASDAQ'],
    ['BILL','Bill Holdings Inc.','NYSE'],['PAYC','Paycom Software Inc.','NYSE'],
    ['ADSK','Autodesk Inc.','NASDAQ'],['ANSS','ANSYS Inc.','NASDAQ'],
    ['CDNS','Cadence Design Systems','NASDAQ'],['SNPS','Synopsys Inc.','NASDAQ'],
    ['ORCL','Oracle Corporation','NYSE'],['SAP','SAP SE','NYSE'],
    ['ADBE','Adobe Inc.','NASDAQ'],['PLTR','Palantir Technologies','NYSE'],
    ['PATH','UiPath Inc.','NYSE'],['AI','C3.ai Inc.','NYSE'],
    ['BBAI','BigBear.ai Holdings','NYSE'],['SOUN','SoundHound AI Inc.','NASDAQ'],
    ['SHOP','Shopify Inc.','NYSE'],['WIX','Wix.com Ltd.','NASDAQ'],
    ['BIGC','BigCommerce Holdings','NASDAQ'],['ETSY','Etsy Inc.','NASDAQ'],
    ['EBAY','eBay Inc.','NASDAQ'],['PYPL','PayPal Holdings Inc.','NASDAQ'],
    ['SQ','Block Inc.','NYSE'],['AFRM','Affirm Holdings Inc.','NASDAQ'],
    ['SOFI','SoFi Technologies Inc.','NASDAQ'],['UPST','Upstart Holdings Inc.','NASDAQ'],
    ['COIN','Coinbase Global Inc.','NASDAQ'],['MSTR','MicroStrategy Incorporated','NASDAQ'],
    ['MARA','Marathon Digital Holdings','NASDAQ'],['RIOT','Riot Platforms Inc.','NASDAQ'],
    ['HOOD','Robinhood Markets Inc.','NASDAQ'],['IBKR','Interactive Brokers Group','NASDAQ'],
    ['SCHW','Charles Schwab Corporation','NYSE'],['TD','Toronto-Dominion Bank','NYSE'],
    ['RY','Royal Bank of Canada','NYSE'],['USB','U.S. Bancorp','NYSE'],
    ['TFC','Truist Financial Corporation','NYSE'],['PNC','PNC Financial Services','NYSE'],
    ['KEY','KeyCorp','NYSE'],['RF','Regions Financial Corporation','NYSE'],
    ['FITB','Fifth Third Bancorp','NASDAQ'],['HBAN','Huntington Bancshares','NASDAQ'],
    ['CFG','Citizens Financial Group','NYSE'],['MTB','M&T Bank Corporation','NYSE'],
    ['CMA','Comerica Incorporated','NYSE'],['ZION','Zions Bancorporation','NASDAQ'],
    ['WAL','Western Alliance Bancorporation','NYSE'],['FHN','First Horizon Corporation','NYSE'],
    ['PACW','PacWest Bancorp','NASDAQ'],['SI','Silvergate Capital','NYSE'],
    ['SPY','SPDR S&P 500 ETF Trust','NYSE'],['VOO','Vanguard S&P 500 ETF','NYSE'],
    ['IVV','iShares Core S&P 500 ETF','NYSE'],['VTI','Vanguard Total Stock Market ETF','NYSE'],
    ['QQQ','Invesco QQQ Trust','NASDAQ'],['TQQQ','ProShares UltraPro QQQ','NASDAQ'],
    ['SQQQ','ProShares UltraPro Short QQQ','NASDAQ'],['IWM','iShares Russell 2000 ETF','NYSE'],
    ['DIA','SPDR Dow Jones Industrial Average ETF','NYSE'],['VXX','iPath S&P 500 VIX ETF','CBOE'],
    ['GLD','SPDR Gold Shares','NYSE'],['SLV','iShares Silver Trust','NYSE'],
    ['USO','United States Oil Fund','NYSE'],['UNG','United States Natural Gas Fund','NYSE'],
    ['TLT','iShares 20+ Year Treasury Bond ETF','NASDAQ'],['HYG','iShares iBoxx High Yield Corp Bond ETF','NYSE'],
    ['LQD','iShares iBoxx Investment Grade Corp Bond ETF','NYSE'],
    ['XLF','Financial Select Sector SPDR Fund','NYSE'],['XLK','Technology Select Sector SPDR Fund','NYSE'],
    ['XLE','Energy Select Sector SPDR Fund','NYSE'],['XLV','Health Care Select Sector SPDR Fund','NYSE'],
    ['XLI','Industrial Select Sector SPDR Fund','NYSE'],['XLY','Consumer Discretionary Select Sector SPDR Fund','NYSE'],
    ['XLP','Consumer Staples Select Sector SPDR Fund','NYSE'],['XLU','Utilities Select Sector SPDR Fund','NYSE'],
    ['XLRE','Real Estate Select Sector SPDR Fund','NYSE'],['XLB','Materials Select Sector SPDR Fund','NYSE'],
    ['ARKK','ARK Innovation ETF','NYSE'],['ARKG','ARK Genomic Revolution ETF','NYSE'],
    ['ARKW','ARK Next Generation Internet ETF','NYSE'],['ARKF','ARK Fintech Innovation ETF','NYSE'],
    ['TSMC','Taiwan Semiconductor Manufacturing','NYSE'],['ASML','ASML Holding N.V.','NASDAQ'],
    ['BABA','Alibaba Group Holding Limited','NYSE'],['JD','JD.com Inc.','NASDAQ'],
    ['PDD','PDD Holdings Inc.','NASDAQ'],['BIDU','Baidu Inc.','NASDAQ'],
    ['NIO','NIO Inc.','NYSE'],['LI','Li Auto Inc.','NASDAQ'],['XPEV','XPeng Inc.','NYSE'],
    ['RIVN','Rivian Automotive Inc.','NASDAQ'],['LCID','Lucid Group Inc.','NASDAQ'],
    ['F','Ford Motor Company','NYSE'],['GM','General Motors Company','NYSE'],
    ['STLA','Stellantis N.V.','NYSE'],['TM','Toyota Motor Corporation','NYSE'],
    ['HMC','Honda Motor Co. Ltd.','NYSE'],['RACE','Ferrari N.V.','NYSE'],
    ['AMC','AMC Entertainment Holdings','NYSE'],['GME','GameStop Corp.','NYSE'],
    ['BB','BlackBerry Limited','NYSE'],['NOK','Nokia Corporation','NYSE'],
    ['SIRI','Sirius XM Holdings Inc.','NASDAQ'],['IMAX','IMAX Corporation','NYSE'],
    ['ROKU','Roku Inc.','NASDAQ'],['TTD','Trade Desk Inc.','NASDAQ'],
    ['RBLX','Roblox Corporation','NYSE'],['U','Unity Software Inc.','NYSE'],
    ['EA','Electronic Arts Inc.','NASDAQ'],['ATVI','Activision Blizzard Inc.','NASDAQ'],
    ['TTWO','Take-Two Interactive Software','NASDAQ'],['NTES','NetEase Inc.','NASDAQ'],
    ['SE','Sea Limited','NYSE'],['GRAB','Grab Holdings Limited','NASDAQ'],
    ['DKNG','DraftKings Inc.','NASDAQ'],['PENN','Penn Entertainment Inc.','NASDAQ'],
    ['MGM','MGM Resorts International','NYSE'],['WYNN','Wynn Resorts Limited','NASDAQ'],
    ['LVS','Las Vegas Sands Corp.','NYSE'],['CZR','Caesars Entertainment Inc.','NASDAQ'],
    ['DPZ','Domino\'s Pizza Inc.','NASDAQ'],['CMG','Chipotle Mexican Grill','NYSE'],
    ['YUM','Yum! Brands Inc.','NYSE'],['QSR','Restaurant Brands International','NYSE'],
    ['SBUX','Starbucks Corporation','NASDAQ'],['SHAK','Shake Shack Inc.','NYSE'],
    ['WEN','Wendy\'s Company','NASDAQ'],['DRI','Darden Restaurants Inc.','NYSE'],
    ['TXRH','Texas Roadhouse Inc.','NASDAQ'],['CAKE','Cheesecake Factory Incorporated','NASDAQ'],
    ['CVNA','Carvana Co.','NYSE'],['KMX','CarMax Inc.','NYSE'],
    ['AN','AutoNation Inc.','NYSE'],['PAG','Penske Automotive Group','NYSE'],
    ['GPC','Genuine Parts Company','NYSE'],['AZO','AutoZone Inc.','NYSE'],
    ['ORLY','O\'Reilly Automotive Inc.','NASDAQ'],['AAP','Advance Auto Parts Inc.','NYSE'],
    ['TGT','Target Corporation','NYSE'],['TJX','TJX Companies Inc.','NYSE'],
    ['ROST','Ross Stores Inc.','NASDAQ'],['BJ','BJ\'s Wholesale Club Holdings','NYSE'],
    ['DG','Dollar General Corporation','NYSE'],['DLTR','Dollar Tree Inc.','NASDAQ'],
    ['BBY','Best Buy Co. Inc.','NYSE'],['BBWI','Bath & Body Works Inc.','NYSE'],
    ['RL','Ralph Lauren Corporation','NYSE'],['PVH','PVH Corp.','NYSE'],
    ['HBI','Hanesbrands Inc.','NYSE'],['NKE','Nike Inc.','NYSE'],
    ['UA','Under Armour Inc. Class C','NYSE'],['LULU','Lululemon Athletica Inc.','NASDAQ'],
    ['COLM','Columbia Sportswear Company','NASDAQ'],['VFC','V.F. Corporation','NYSE'],
    ['PEP','PepsiCo Inc.','NASDAQ'],['KO','Coca-Cola Company','NYSE'],
    ['MNST','Monster Beverage Corporation','NASDAQ'],['KDP','Keurig Dr Pepper Inc.','NASDAQ'],
    ['STZ','Constellation Brands Inc.','NYSE'],['BUD','Anheuser-Busch InBev','NYSE'],
    ['TAP','Molson Coors Beverage Company','NYSE'],['SAM','Boston Beer Company','NYSE'],
    ['PM','Philip Morris International','NYSE'],['MO','Altria Group Inc.','NYSE'],
    ['BTI','British American Tobacco','NYSE'],['GIS','General Mills Inc.','NYSE'],
    ['K','Kellanova','NYSE'],['CPB','Campbell Soup Company','NYSE'],
    ['HSY','Hershey Company','NYSE'],['MDLZ','Mondelez International','NASDAQ'],
    ['KHC','Kraft Heinz Company','NASDAQ'],['SJM','J.M. Smucker Company','NYSE'],
    ['CAG','ConAgra Brands Inc.','NYSE'],['HRL','Hormel Foods Corporation','NYSE'],
    ['TSN','Tyson Foods Inc.','NYSE'],['POST','Post Holdings Inc.','NYSE'],
    ['INGR','Ingredion Incorporated','NYSE'],['CALM','Cal-Maine Foods Inc.','NASDAQ'],
    ['SPG','Simon Property Group','NYSE'],['O','Realty Income Corporation','NYSE'],
    ['AMT','American Tower Corporation','NYSE'],['PLD','Prologis Inc.','NYSE'],
    ['CCI','Crown Castle Inc.','NYSE'],['EQIX','Equinix Inc.','NASDAQ'],
    ['PSA','Public Storage','NYSE'],['EQR','Equity Residential','NYSE'],
    ['AVB','AvalonBay Communities Inc.','NYSE'],['VTR','Ventas Inc.','NYSE'],
    ['WELL','Welltower Inc.','NYSE'],['DLR','Digital Realty Trust Inc.','NYSE'],
    ['IRM','Iron Mountain Incorporated','NYSE'],['PEAK','Healthpeak Properties Inc.','NYSE'],
    ['HST','Host Hotels & Resorts Inc.','NASDAQ'],['AIR','AAR Corp.','NYSE'],
  ]
  return stocks.map(([symbol, name, exchange]) => ({
    symbol,
    name,
    market: 'US',
    exchange: exchange || 'NASDAQ',
    yahooKey: symbol
  }))
}
