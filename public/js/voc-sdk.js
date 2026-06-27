const VOC_GAS = 'https://script.google.com/macros/s/AKfycbxu24IH7mD_DE4S5tB_Aebhtz-psa-qUlHmAtRVKlfh9tpprwSGE8Z1KFTL_XuC2sonLA/exec';
export const VOC_PROJECT = 'blog-challenge';
export const VOC_CATEGORIES = ['버그', '기능추가', '개선', '기타'];

export async function submitVoc({ message, category, phone = '', channel = 'app' }) {
  const res = await fetch(VOC_GAS, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'submitVoc',
      project: VOC_PROJECT,
      message,
      category: category || '기타',
      channel,
      phone,
    }),
  });
  return res.json();
}
