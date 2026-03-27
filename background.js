// background.js — Service Worker for Pomodoro Timer

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pomodoroEnd') {
    chrome.storage.local.get(['mode'], (data) => {
      const mode = data.mode || 'focus';
      const title = mode === 'focus' ? '🍅 Focus session done!' : '☕ Break time over!';
      const message = mode === 'focus'
        ? 'Great work! Time for a short break.'
        : 'Break is over. Ready to focus again?';

      chrome.notifications.create('pomodoroNotif', {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title,
        message,
        priority: 2
      });

      // Auto-reset state
      chrome.storage.local.set({ running: false, finished: true });
    });
  }
});
