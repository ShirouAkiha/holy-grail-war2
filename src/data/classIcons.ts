export const CLASS_ICON_URLS: Record<string, string> = {
  shielder: 'https://ella.janitorai.com/media-approved/R9X49ey9Vb1yjvU2OlorG.webp',
  archer: 'https://ella.janitorai.com/media-approved/pjUTGZ-AcUKsbURcw250Z.webp',
  caster: 'https://ella.janitorai.com/media-approved/0uU09slio-a9gZv9mmnNO.webp',
  ruler: 'https://ella.janitorai.com/media-approved/2AgnJGGinmtCgDC7IvlpW.webp',
  avenger: 'https://ella.janitorai.com/media-approved/13SCdsfvtPWbalRastAI-.webp',
  foreigner: 'https://ella.janitorai.com/media-approved/EB6ylzlMYLFD6Z_LeC2aV.webp',
  berserker: 'https://ella.janitorai.com/media-approved/5VOnIyjC5J0QnMtLf4vI1.webp',
  assassin: 'https://ella.janitorai.com/media-approved/CgYMv-2h0FhzG0CtFVqix.webp',
  'alter ego': 'https://ella.janitorai.com/media-approved/ALinwDPEiv5oFYrA4a4uh.webp',
  alterego: 'https://ella.janitorai.com/media-approved/ALinwDPEiv5oFYrA4a4uh.webp',
  rider: 'https://ella.janitorai.com/media-approved/33uygbj8A0d8n765p4vZU.webp',
  saber: 'https://ella.janitorai.com/media-approved/e_QsvwekeMEJDsVO4gxM0.webp',
  lancer: 'https://ella.janitorai.com/media-approved/hWSScQTtbBflETSQuxq12.webp',
  mooncancer: 'https://ella.janitorai.com/media-approved/Jn2NcjIPZbF3VnXgFuzOt.webp',
  'moon cancer': 'https://ella.janitorai.com/media-approved/Jn2NcjIPZbF3VnXgFuzOt.webp',
  pretender: 'https://ella.janitorai.com/media-approved/2AgnJGGinmtCgDC7IvlpW.webp',
  beast: 'https://ella.janitorai.com/media-approved/0e2G0RijgX5dnEjjuZPBm.webp',
  'beast ii': 'https://ella.janitorai.com/media-approved/0e2G0RijgX5dnEjjuZPBm.webp',
};

export function getClassIconUrl(servantClass?: string): string {
  if (!servantClass) return CLASS_ICON_URLS.saber;
  const key = servantClass.toLowerCase().replace(/[-_]/g, ' ').trim();
  const direct = CLASS_ICON_URLS[key] || CLASS_ICON_URLS[key.replace(/\s+/g, '')];
  if (direct) return direct;
  for (const [k, url] of Object.entries(CLASS_ICON_URLS)) {
    if (key.includes(k) || k.includes(key)) return url;
  }
  return CLASS_ICON_URLS.saber;
}
