export function createTitleMusic(button, volume) {
  const music = new Audio(`${import.meta.env.BASE_URL}audio/the-drowning-credits.mp3`);
  music.loop = true;
  music.preload = "metadata";
  music.volume = volume;
  let active = true;
  let enabled = true;
  function update() {
    button.textContent = music.paused ? "Play title music" : "Pause title music";
    button.setAttribute("aria-pressed", String(!music.paused));
  }
  function play() {
    if (active && enabled && !document.hidden) music.play().catch(update);
  }
  music.addEventListener("play", update);
  music.addEventListener("pause", update);
  button.addEventListener("click", () => {
    enabled = music.paused;
    if (enabled) play();
    else music.pause();
  });
  // A first gesture unlocks audio on browsers that block audible autoplay.
  for (const event of ["pointerdown", "keydown"]) {
    document.addEventListener(event, (e) => {
      if (e.target !== button && music.paused) play();
    });
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) music.pause();
    else play();
  });
  update();
  play();
  return {
    setVolume(value) { music.volume = value; },
    setActive(value) {
      active = value;
      if (active) play();
      else {
        music.pause();
        music.currentTime = 0;
      }
    },
  };
}
