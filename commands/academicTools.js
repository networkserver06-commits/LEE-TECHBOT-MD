'use strict';

const dns = require('node:dns').promises;
const https = require('node:https');
const { URL } = require('node:url');
const fetch = require('node-fetch');

function reply(sock, chatId, message, text) { return sock.sendMessage(chatId, { text }, { quoted: message }); }
function clean(value) { return String(value || '').trim(); }
function validHost(value) { return /^[a-z0-9.-]+$/i.test(value) && value.length <= 253 && !value.includes('..'); }
function httpJson(url) {
    return new Promise((resolve, reject) => {
        const request = https.get(url, { headers: { 'User-Agent': 'LEE-TECH-BOT/1.0' }, timeout: 12000 }, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; if (body.length > 2_000_000) res.destroy(new Error('response too large')); });
            res.on('end', () => { try { resolve(JSON.parse(body)); } catch (error) { reject(error); } });
        });
        request.on('timeout', () => request.destroy(new Error('request timeout')));
        request.on('error', reject);
    });
}

async function whoisCommand(sock, chatId, message, args) {
    const target = clean(args[0]);
    if (!target) return reply(sock, chatId, message, 'Usage: !whois <domain or IP>');
    try {
        const data = await httpJson(`https://ipwho.is/${encodeURIComponent(target)}`);
        if (!data.success) return reply(sock, chatId, message, '❌ WHOIS/IP lookup could not resolve that target.');
        return reply(sock, chatId, message, `🔎 *LOOKUP*\nTarget: ${target}\nType: ${data.type || 'domain/IP'}\nIP: ${data.ip || target}\nCountry: ${data.country || 'Unknown'}\nCity: ${data.city || 'Unknown'}\nISP: ${data.connection?.isp || 'Unknown'}\nOrg: ${data.connection?.org || 'Unknown'}`);
    } catch (error) { console.error('[whois]', error.message); return reply(sock, chatId, message, '❌ Lookup service unavailable.'); }
}

async function pingHostCommand(sock, chatId, message, args) {
    const host = clean(args[0]).replace(/^https?:\/\//i, '').split('/')[0];
    if (!validHost(host)) return reply(sock, chatId, message, 'Usage: !ping <domain or IP>');
    const started = Date.now();
    try {
        const response = await new Promise((resolve, reject) => {
            const request = https.request(`https://${host}`, { method: 'HEAD', timeout: 10000, rejectUnauthorized: false }, (res) => { res.resume(); resolve(res); });
            request.on('timeout', () => request.destroy(new Error('timeout'))); request.on('error', reject); request.end();
        });
        return reply(sock, chatId, message, `🏓 *HOST CHECK*\nHost: ${host}\nHTTP: ${response.statusCode}\nLatency: ${Date.now() - started} ms`);
    } catch (error) { return reply(sock, chatId, message, `❌ ${host} is unreachable over HTTPS (${error.code || 'timeout'}).`); }
}

async function dnsCommand(sock, chatId, message, args) {
    const host = clean(args[0]); const record = clean(args[1] || 'A').toUpperCase();
    const allowed = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS'];
    if (!validHost(host) || !allowed.includes(record)) return reply(sock, chatId, message, `Usage: !dns <domain> <${allowed.join('|')}>`);
    try {
        const values = await dns.resolve(host, record);
        const lines = values.map((value) => typeof value === 'object' ? JSON.stringify(value) : String(value));
        return reply(sock, chatId, message, `🌐 *DNS ${record}*\n${host}\n\n${lines.join('\n').slice(0, 3000)}`);
    } catch (error) { return reply(sock, chatId, message, `❌ No ${record} record found for ${host}.`); }
}

async function scholarCommand(sock, chatId, message, args) {
    const query = clean(args.join(' '));
    if (!query) return reply(sock, chatId, message, 'Usage: !scholar <research query>');
    try {
        const data = await httpJson(`https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=5&select=title,publication_year,doi,primary_location,cited_by_count`);
        const rows = (data.results || []).map((item, index) => {
            const url = item.doi || item.primary_location?.landing_page_url || 'No direct link';
            return `${index + 1}. *${item.title || 'Untitled'}* (${item.publication_year || 'n.d.'})\nCitations: ${item.cited_by_count || 0}\n${url}`;
        });
        return reply(sock, chatId, message, `🎓 *OPENALEX RESULTS*\n\n${rows.join('\n\n') || 'No papers found.'}`.slice(0, 3800));
    } catch (error) { console.error('[scholar]', error.message); return reply(sock, chatId, message, '❌ Academic search is currently unavailable.'); }
}

function mathCommand(sock, chatId, message, args) {
    const expression = clean(args.join(' '));
    if (!expression || expression.length > 200 || !/^[0-9+\-*/%().,\s^]+$/.test(expression)) return reply(sock, chatId, message, 'Usage: !math <basic expression>\nExample: !math (12 + 8) / 4 ^ 2');
    try {
        const normalized = expression.replace(/\^/g, '**');
        const result = Function(`"use strict"; return (${normalized})`)();
        if (typeof result !== 'number' || !Number.isFinite(result)) throw new Error('invalid');
        return reply(sock, chatId, message, `🧮 ${expression} = *${result}*`);
    } catch (_) { return reply(sock, chatId, message, '❌ Could not evaluate that expression.'); }
}

function pdfBuffer(text) {
    const safe = String(text).replace(/[\\()]/g, '\\$&').replace(/[^\x20-\x7E\n]/g, ' ');
    const lines = safe.split(/\r?\n/).flatMap((line) => line.match(/.{1,90}/g) || ['']).slice(0, 100);
    const stream = ['BT', '/F1 11 Tf', '50 770 Td', ...lines.flatMap((line, index) => [index ? '0 -15 Td' : '', `(${line}) Tj`]).filter(Boolean), 'ET'].join('\n');
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
        `<< /Length ${Buffer.byteLength(stream) + 1} >>\nstream\n${stream}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
    ];
    let pdf = '%PDF-1.4\n'; const offsets = [0];
    for (let i = 0; i < objects.length; i++) { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`; }
    const xref = Buffer.byteLength(pdf); pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => String(offset).padStart(10, '0') + ' 00000 n ').join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(pdf);
}
async function pdfCommand(sock, chatId, message, args) {
    const input = clean(args.join(' '));
    if (!input) return reply(sock, chatId, message, 'Usage: !pdf <URL or text>');
    try {
        let text = input;
        if (/^https?:\/\//i.test(input)) {
            const response = await fetch(input, { timeout: 15000 });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            text = (await response.text()).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        }
        const buffer = pdfBuffer(text);
        return sock.sendMessage(chatId, { document: buffer, mimetype: 'application/pdf', fileName: 'lee-tech-notes.pdf', caption: '📄 PDF generated by LEE TECH BOT' }, { quoted: message });
    } catch (error) { console.error('[pdf]', error.message); return reply(sock, chatId, message, '❌ Could not generate the PDF from that input.'); }
}

module.exports = { whoisCommand, pingHostCommand, dnsCommand, scholarCommand, mathCommand, pdfCommand };
