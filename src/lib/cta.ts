// Localized "Download the Bible App!" call-to-action for the promo template.
// Users can override the text in the form; this just seeds a sensible default
// per language. Falls back to English.
const CTA_BY_LANGUAGE: Record<string, string> = {
  en: 'Download the Bible App!',
  es: '¡Descarga la App de la Biblia!',
  'es-LA': '¡Descarga la App de la Biblia!',
  pt: 'Baixe o App da Bíblia!',
  fr: "Téléchargez l'App de la Bible !",
  de: 'Lade die Bibel App herunter!',
  af: 'Laai die Bybel App af!',
  it: "Scarica l'App della Bibbia!",
  nl: 'Download de Bijbel App!',
  id: 'Unduh Aplikasi Alkitab!',
  ru: 'Скачайте приложение Библия!',
  uk: 'Завантажте додаток Біблія!',
  pl: 'Pobierz aplikację Biblia!',
  ro: 'Descarcă aplicația Biblia!',
  tr: 'İncil Uygulamasını İndir!',
  vi: 'Tải Ứng dụng Kinh Thánh!',
  th: 'ดาวน์โหลดแอปพระคัมภีร์!',
  ko: '성경 앱을 다운로드하세요!',
  ja: '聖書アプリをダウンロード！',
  zh_CN: '下载圣经App！',
  zh_TW: '下載聖經App！',
  ar: 'حمّل تطبيق الكتاب المقدس!',
  hi: 'बाइबल ऐप डाउनलोड करें!',
  sw: 'Pakua Programu ya Biblia!',
};

export function defaultCta(languageCode: string): string {
  return (
    CTA_BY_LANGUAGE[languageCode] ??
    CTA_BY_LANGUAGE[languageCode.split(/[-_]/)[0]] ??
    CTA_BY_LANGUAGE.en
  );
}
