/**
 * Phone tab — a placeholder for now, sharing the .coming-soon component with
 * the boss-gated pot plates.
 */

const TEASERS = [
  { icon: '📬', title: 'Letters', text: 'Neighbours write in asking for specific blooms.' },
  { icon: '📸', title: 'Garden Album', text: 'Snapshots of every plant you have ever bloomed.' },
  { icon: '🗺️', title: 'Expeditions', text: 'Send seeds off to find rarer strains.' },
];

export function initPhone() {
  const host = document.getElementById('phone-teasers');
  if (!host) return;
  host.replaceChildren();
  for (const teaser of TEASERS) {
    const li = document.createElement('li');
    li.className = 'teaser';
    li.innerHTML = `
      <span class="teaser__icon" aria-hidden="true">${teaser.icon}</span>
      <span class="teaser__body">
        <span class="teaser__title">${teaser.title}</span>
        <span class="teaser__text">${teaser.text}</span>
      </span>`;
    host.append(li);
  }
}
