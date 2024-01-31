export function getVideoUrl(origin: any) {
    const signature = require('./video.signature.js')

    const tmp = {
        AccessKeyId: origin.accessKeyId,
        Action: 'GetPlayInfo',
        VideoId: origin.vid,
        Formats: '',
        AuthTimeout: 7200,
        Rand: signature.randomUUID(),
        SecurityToken: origin.securityToken,
        StreamType: 'video',
        Format: 'JSON',
        Version: '2017-03-21',
        SignatureMethod: 'HMAC-SHA1',
        SignatureVersion: '1.0',
        SignatureNonce: signature.randomUUID(),
        PlayerVersion: '2.9.3',
        Channel: 'HTML5',
        PlayConfig: '{}',
        ReAuthInfo: '{}',
    }

    const queries = signature.makeUTF8sort(tmp, '=', '&') + '&Signature=' + signature.AliyunEncodeURI(signature.makeChangeSiga(tmp, origin.accessKeySecret))

    return 'https://vod.' + origin.region + '.aliyuncs.com/?' + queries
}
