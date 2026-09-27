// Static, public brand artwork. These URLs are also used by the admin composer;
// selected artwork is uploaded through the existing validated community media API.
export const brandArtwork = [
  '1790548742847',
  '1790548742889',
  '1790548742914',
  '1790548742949',
  '1790548743010',
  '1790548743033',
  '1790548743065',
  '1790548743093',
  '1790548743113',
  '1790548743134',
  '1790548743164',
  '1790548743182',
  '1790548743203',
  '1790548743225',
  '1790548743246',
  '1790548743267',
].map((id) => ({ id, url: `/brand-artwork/${id}.png` }));