const puppeteer = require('puppeteer');
const fs = require('fs');
const targets = JSON.parse(fs.readFileSync('data/targets.json').toString());
const config = JSON.parse(fs.readFileSync('data/.config').toString());
const Julius = require('./julius');

function waitFor(condition) {
  return new Promise(resolve=>{
    var timer = setInterval(()=>{
      var result = condition();
      if(result) {
        clearInterval(timer);
        resolve(result);
      }
    }, 500);
  });
}

async function login(page) {
  const accountNameEl = await waitFor(async ()=> {
      console.log('Waiting login page component');
      const existed = await page.evaluate(()=>!!document.getElementById('accountNameInput'));
      return existed;
  });
  console.log('Try to Login');
  await page.evaluate(config=>{
    var user = angular.element(document.getElementsByName('username')[0]);
    var password = angular.element(document.getElementsByName('password')[0]);
    user.val(config.user);
    user.change();
    password.val(config.password);
    password.change();
    document.querySelector('[type="submit"]').click();
  }, config);
}

function getScreenSize(page) {
  return page.evaluate(async ()=>{
    return { width: window.screen.width, height: window.screen.height };
  });
}
var ready = async (left, browserLabel) => {
  const browser = await puppeteer.launch({headless: false, args: ['--window-position=' + left + ',0', '--start-fullscreen']});
  //const browser = await puppeteer.launch({headless: false, args: ['--start-fullscreen','--ash-host-window-bounds=100+200-1024x768']});
  const pages = await browser.pages();
  const page = pages[0];
  const screenSize = await getScreenSize(page);
  console.log('Start session');
  page.setViewport(screenSize);
  console.log('Set view port');
  await page.goto(config.url);
  console.log(config.url + ' opened');
  await login(page);
  var lastUrl = getLastUrl(browserLabel);
  if (lastUrl){
     setTimeout(()=> page.goto(lastUrl), 5000);
  }
  return browser;
};

var nextPage = async (browser, param) => {
  const page = await getCurrentPage();
  const parameter = '&from=' + param.from + '&to=' + param.to;
  const nextUrl = await page.evaluate(param => {
    var url_base = location.href.replace(/from.*/,'');
    return location.href = url_base + '&from=' + param.from + '&to=' + param.to;
  }, param);
  saveLastUrl(currentBrowser, nextUrl);
};

async function saveLastUrl(browser, lasturl) {
  await fs.writeFile('data/'+browser+'.lasturl.data', lasturl, (e)=> {
    console.log('[SAVED]' + browser + ' : ' + lasturl);
  });
}

function getLastUrl(browser) {
  try {
    var fileName = 'data/'+browser+'.lasturl.data';
    fs.statSync(fileName);
    return fs.readFileSync(fileName).toString();
  } catch (err) {
    return '';
  }
}

async function saveLastUrlAll() {
  return Promise.all(
    Object.keys(browsers).map(async browser=>{
      const page = await getPage(browser);
      const url = await page.evaluate(()=> location.href);
      await saveLastUrl(browser, url);
    })
  );
}
var IAmReady = false;

var browsers = {};
var currentBrowser = '';
var prepareBrowsers = async (params) => {
  if(params[2] !== 'areyouready') {
    console.log('What do you want?');
    return;
  }
  if(IAmReady) {
    console.log('Finnish or preparing. just a while');
    return;
  }
  IAmReady = true;
  browsers.right || (browsers.right = await ready(1920*2, 'right'));
  browsers.middle || (browsers.middle = await ready(1920, 'middle'));
  browsers.left || (browsers.left = await ready(0, 'left'));
};

var takeABreak = ()=>{IAmReady = false;};

var setBrowser= async (params) => {
  const exPage = browsers[currentBrowser] ? await getCurrentPage() : null;
  exPage && await exPage.evaluate(()=>{
    var el = document.getElementsByClassName('navbar__spacer')[0];
    el.innerText = '';
  });
  var browser = params[params.length - 2];
  currentBrowser = browser;
  const page = await getCurrentPage();
  await page.evaluate(()=>{
    var el = document.getElementsByClassName('navbar__spacer')[0];
    el.innerText = 'Monica is here';
    el.style.textAlign = "center";
    window.focus();
  });
  console.log(browser + ' is setted');
};

var openPage = async (params) => {
  const page = await getCurrentPage();
  var target = targets[params[params.length - 2]];
  var nextUrl = config.url + target.dashboard;
  await page.goto(nextUrl);
  saveLastUrl(currentBrowser, nextUrl);
};

var changeRange = async (params) => {
  const page = await getCurrentPage();
  var offset = params[2]+params[3][0];
  var range = '&from=now-' + offset + '&to=now';
  const nextUrl = await page.evaluate(range => {
    var url_base = location.href.replace(/from.*/,'');
    location.href = url_base + range;
    return location.href;
  }, range);
  saveLastUrl(currentBrowser, nextUrl);
};

var backPage = async () => {
  const page = await getCurrentPage();
  page.evaluate(()=> {
    history.back();
  });
};

var getCurrentPage = async () => {
  return await getPage(currentBrowser);
};

var getPage = async browser => {
  const pages = await browsers[browser].pages();
  return pages[0];
};

var actions = {
 hey : prepareBrowsers,
 takeabreak : takeABreak,
 browser :  setBrowser,
 open :  openPage,
 rangeis : changeRange,
 back :  backPage
};

var undefinededAction = (params, action) => { console.error(action + ' is not defined yet.')};
var getAndDoAction = async (action, params) => {
  return await (actions[action]||undefinededAction)(params, action);
};

console.log('I gonna to work');

julius = new Julius({
    host: '172.16.150.3',
    port: 10500
});
julius.on('recognitionSuccess', function (recognition) {
    if (recognition[0].words.find(d=>d.cm<0.5)) {
        // What are you talking about
        return;
    }
    var words = recognition[0].words.map(d=>d.word);
    var action = words[1];
    getAndDoAction(action, words);
    console.log(JSON.stringify(recognition));
});

// Using a single function to handle multiple signals
async function handle(signal) {
  console.log(`Received ${signal}`);
  console.log('Try to close julius');
  await julius.close();
}

process.on('SIGINT', handle);
process.on('SIGTERM', handle);

