import browser from 'webextension-polyfill';

const SYNC_ALARM = 'pinjamakun-sync';

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    void browser.alarms.create(SYNC_ALARM, { periodInMinutes: 15 });
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== SYNC_ALARM) return;
    // The server sync queue will be connected after device pairing is implemented.
  });

  browser.permissions.onRemoved.addListener((permissions) => {
    if ((permissions.origins?.length ?? 0) > 0) {
      void browser.storage.local.set({ lastPermissionRemovalAt: new Date().toISOString() });
    }
  });
});
