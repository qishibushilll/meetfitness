const SHOW_BACK_TOP_SCROLL = 480;

function shouldShowBackTop(scrollTop) {
  return Number(scrollTop || 0) > SHOW_BACK_TOP_SCROLL;
}

function scrollToTop() {
  wx.pageScrollTo({
    scrollTop: 0,
    duration: 240
  });
}

module.exports = {
  shouldShowBackTop,
  scrollToTop
};
