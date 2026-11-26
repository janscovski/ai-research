/**
 * Near-instant refresh for the website when the deck changes.
 *
 * Google Slides has NO onEdit trigger (that exists only for Sheets), so this uses:
 *   1. A "Website → Publish now" menu inside the deck (instant, manual).
 *   2. A time-driven trigger every minute that pings the site only when the
 *      deck's Drive "last updated" time changed.
 *
 * Setup: open the deck → Extensions → Apps Script → paste this file.
 * Project Settings → Script properties:
 *   SITE_URL           e.g. https://ai-optimization.example.com
 *   REVALIDATE_SECRET  same value as the website env var
 *   DECK_ID            the deck's id (used by the every-minute trigger)
 * Run installTrigger() once and approve the permissions.
 */

function onOpen() {
  SlidesApp.getUi().createMenu('Website').addItem('Publish now', 'publishNow').addToUi();
}

function publishNow() {
  const res = ping_();
  SlidesApp.getUi().alert(res === 200 ? 'Website refreshed.' : 'Refresh failed (HTTP ' + res + ').');
}

function checkForChanges() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('DECK_ID');
  if (!id) {
    const deck = SlidesApp.getActivePresentation();
    if (!deck) throw new Error('Set the DECK_ID script property.');
    id = deck.getId();
  }
  const updated = DriveApp.getFileById(id).getLastUpdated().getTime();
  const last = Number(props.getProperty('LAST_SEEN') || 0);
  if (updated > last) {
    if (ping_() === 200) props.setProperty('LAST_SEEN', String(updated));
  }
}

function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'checkForChanges') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('checkForChanges').timeBased().everyMinutes(1).create();
}

function ping_() {
  const props = PropertiesService.getScriptProperties();
  const res = UrlFetchApp.fetch(props.getProperty('SITE_URL') + '/api/revalidate', {
    method: 'post',
    headers: { 'x-revalidate-secret': props.getProperty('REVALIDATE_SECRET') },
    muteHttpExceptions: true,
  });
  return res.getResponseCode();
}
