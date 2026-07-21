export interface VersionExportRow {
  version_id: string;
  reference: string;
  verse_text: string;
  air_cdn_link: string;
}

export interface GeoImage {
  url: string;
  credit: string;
}

export interface GeoResult {
  country: string;
  capital: string;
  images: GeoImage[];
  languages: { code: string; name: string }[];
}
