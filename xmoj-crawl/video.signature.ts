import hmacsha1 from 'crypto-js/hmac-sha1'
import encbase64 from 'crypto-js/enc-base64'
import encutf8 from 'crypto-js/enc-utf8'

module.exports.randomUUID = function () {
  for (var e = [], t = "0123456789abcdef", r = 0; r < 36; r++)
    e[r] = t.substr(Math.floor(16 * Math.random()), 1);
  return e[14] = "4",
    // @ts-ignore
    e[19] = t.substr(3 & e[19] | 8, 1),
    e[8] = e[13] = e[18] = e[23] = "-",
    e.join("")
}
module.exports.returnUTCDate = function () {
  var e = new Date
    , t = e.getUTCFullYear()
    , r = e.getUTCMonth()
    , i = e.getUTCDate()
    , n = e.getUTCHours()
    , o = e.getUTCMinutes()
    , a = e.getUTCSeconds()
    , s = e.getUTCMilliseconds();
  return Date.UTC(t, r, i, n, o, a, s)
}

// @ts-ignore
module.exports.AliyunEncodeURI = function (e) {
  var t = encodeURIComponent(e);
  return t = (t = (t = t.replace("+", "%2B")).replace("*", "%2A")).replace("%7E", "~")
}

// @ts-ignore
module.exports.makesort = function (e, t, r) {
  if (!e)
    throw new Error("PrismPlayer Error: vid should not be null!");
  var i = [];
  for (var n in e)
    i.push(n);
  // @ts-ignore
  for (var o = i.sort(), a = "", s = o.length, n = 0; n < s; n++)
    // @ts-ignore
    "" == a ? a = o[n] + t + e[o[n]] : a += r + o[n] + t + e[o[n]];
  return a
}

// @ts-ignore
module.exports.makeUTF8sort = function (e, t, r) {
  if (!e)
    throw new Error("PrismPlayer Error: vid should not be null!");
  var i = [];
  for (var n in e)
    i.push(n);
  // @ts-ignore
  for (var o = i.sort(), a = "", s = o.length, n = 0; n < s; n++) {
    // @ts-ignore
    var l = module.exports.AliyunEncodeURI(o[n])
      // @ts-ignore
      , u = module.exports.AliyunEncodeURI(e[o[n]]);
    "" == a ? a = l + t + u : a += r + l + t + u
  }
  return a
}

// @ts-ignore
module.exports.makeChangeSiga = function (e, t, r) {
  if (!e)
    throw new Error("PrismPlayer Error: vid should not be null!");
  return r = r || "GET",
    encbase64.stringify(hmacsha1(r + "&" + module.exports.AliyunEncodeURI("/") + "&" + module.exports.AliyunEncodeURI(module.exports.makeUTF8sort(e, "=", "&")), t + "&"))
}

// @ts-ignore
module.exports.ISODateString = function (e) {
  // @ts-ignore
  function t(e) {
    return e < 10 ? "0" + e : e
  }
  return e.getUTCFullYear() + "-" + t(e.getUTCMonth() + 1) + "-" + t(e.getUTCDate()) + "T" + t(e.getUTCHours()) + ":" + t(e.getUTCMinutes()) + ":" + t(e.getUTCSeconds()) + "Z"
}

// @ts-ignore
module.exports.encPlayAuth = function (e) {
  if (!(e = encutf8.stringify(encbase64.parse(e))))
    throw new Error("playuth\u53c2\u6570\u89e3\u6790\u4e3a\u7a7a");
  return JSON.parse(e)
}

module.exports.encRsa = function () { }
