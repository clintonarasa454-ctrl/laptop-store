export const getCompareList = () => {
  try { return JSON.parse(localStorage.getItem("store_compare_list") || "[]"); } catch { return []; }
};

export const toggleCompare = (product: any) => {
  let list = getCompareList();
  const exists = list.find((p: any) => p.id === product.id);
  if (exists) {
    list = list.filter((p: any) => p.id !== product.id);
  } else {
    if (list.length >= 4) return false;
    list.push(product);
  }
  localStorage.setItem("store_compare_list", JSON.stringify(list));
  window.dispatchEvent(new Event("compareUpdated"));
  return !exists;
};

export const getRecentlyViewed = () => {
  try { return JSON.parse(localStorage.getItem("store_recent_list") || "[]"); } catch { return []; }
};

export const addRecentlyViewed = (product: any) => {
  if (!product) return;
  let list = getRecentlyViewed();
  list = [product, ...list.filter((p: any) => p.id !== product.id)].slice(0, 8); // Keep last 8
  localStorage.setItem("store_recent_list", JSON.stringify(list));
};