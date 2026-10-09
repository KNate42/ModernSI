// The two ticker bands under the hero: trending idea titles and campus names. Calm by default, moving only in full motion mode.
// This work made by Anfinogentov Nikita
"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";

const speed = 55;

// One band: the list once, then clones. The server sends one clone and the calm CSS hides it. In motion mode the browser asks for more
// until the track is wider than the screen, and the doubled track loops without a seam.
function Track({ items }: { items: string[] }) {
  const [layout, setLayout] = useState({ copies: 1, duration: 60 });
  const first = useRef<HTMLUListElement>(null);

  useEffect(() => {
    // the widths depend on the web fonts, so I measure after they are loaded and again when the window changes
    const measure = () => {
      const list = first.current;
      if (document.documentElement.dataset.motion !== "full" || !list?.offsetWidth) return;
      const copies = Math.max(1, Math.ceil((Math.max(window.innerWidth, screen.width) * 1.2) / list.offsetWidth));
      const duration = Math.round((list.offsetWidth * copies) / speed);
      setLayout((current) => (current.copies === copies && current.duration === duration ? current : { copies, duration }));
    };
    document.fonts.ready.then(measure);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <div className="ribbon-track" style={{ "--ribbon-duration": `${layout.duration}s` } as React.CSSProperties}>
      {Array.from({ length: layout.copies * 2 }, (_, index) => (
        <ul key={index} ref={index === 0 ? first : undefined} className={index === 0 ? "ribbon-list" : "ribbon-list ribbon-clone"} aria-hidden={index === 0 ? undefined : true}>
          {items.map((item, position) => <li key={position}>{item}</li>)}
        </ul>
      ))}
    </div>
  );
}

export function Ribbons({ ideas, campuses }: { ideas: string[]; campuses: string[] }) {
  const [paused, setPaused] = useState(false);
  return (
    <section className={campuses.length ? "ribbons" : "ribbons ribbons-single"} aria-label="Ideas students are backing right now" data-paused={paused ? "" : undefined}>
      <div className="ribbon ribbon-ideas">
        <Track items={ideas} />
        <button className="ribbon-pause" type="button" aria-pressed={paused} aria-label="Pause ticker" onClick={() => setPaused((value) => !value)}>
          <Icon name="pause" className="icon-pause" />
          <Icon name="play" className="icon-play" />
        </button>
      </div>
      {campuses.length > 0 && (
        <div className="ribbon ribbon-campuses" aria-hidden="true">
          <Track items={campuses} />
        </div>
      )}
    </section>
  );
}
