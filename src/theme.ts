// Shared by the server layout and the client toggle. The site always opens in light unless the visitor chose dark.
export const THEME_KEY='bm-theme';
// Runs in <head> before the first paint (app/layout.tsx), so a saved dark choice never flashes light.
export const themeBootScript=`try{if(localStorage.getItem('${THEME_KEY}')==='dark')document.documentElement.dataset.theme='dark'}catch(e){}`;
