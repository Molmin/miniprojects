import {
  addPage, i18n, NamedPage, tpl,
} from '@hydrooj/ui-default';

addPage(new NamedPage(['training_detail'], () => {
  const menu = $('div.section.side:first-child > div:first-child > ol');
  $(tpl`<li class="menu__item"><a class="menu__link" href="${window.location.pathname}/scoreboard">
    <span class="icon icon-statistics"></span> ${i18n('Scoreboard')}
  </a></li>`).appendTo(menu);
}));
