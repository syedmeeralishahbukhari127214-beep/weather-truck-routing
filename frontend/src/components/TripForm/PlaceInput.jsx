import { useEffect, useId, useState } from "react";
import { geocode } from "../../api/client";

export default function PlaceInput({ label, value, onChange, error, icon }) {
  const id = useId();
  const listId = `${id}-list`;
  const [text, setText] = useState("");
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    if (value || text.trim().length < 3) {
      setOptions([]);
      return undefined;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setOptions(await geocode(text.trim(), ctrl.signal));
        setActive(-1);
        setOpen(true);
      } catch (err) {
        if (err.name !== "AbortError") setOptions([]);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [text, value]);

  function choose(place) {
    setText(place.label);
    onChange(place);
    setOpen(false);
  }

  function onKeyDown(e) {
    if (!open || !options.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      choose(options[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#4a5f67]">
        <span className="text-[#0b5d6b]">{icon}</span>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          autoComplete="off"
          role="combobox"
          aria-expanded={open && options.length > 0}
          aria-controls={listId}
          aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
          aria-invalid={Boolean(error)}
          value={text}
          placeholder={label === "From (Origin)" ? "Dallas, Texas, United States" : "Dayton, Ohio, United States"}
          className="h-11 w-full rounded-lg border border-[#aab8b5] bg-[#f4f7f6] px-3 pl-10 text-sm text-[#12262e] placeholder:text-[#4a5f67] focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          onChange={(e) => {
            setText(e.target.value);
            if (value) onChange(null);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => options.length && setOpen(true)}
          onBlur={() => setOpen(false)}
        />
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#0b5d6b]">
          {icon}
        </span>
      </div>
      {open && options.length > 0 && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-lg border border-[#aab8b5] bg-white shadow-xl">
          {options.map((o, i) => (
            <li
              key={`${o.lat},${o.lon}`}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              className={`cursor-pointer px-3 py-2 text-sm text-[#12262e] ${i === active ? "bg-[#e3eff1]" : "hover:bg-[#e3eff1]"}`}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(o);
              }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-1 text-xs text-[#b3261e]">{error}</p>}
    </div>
  );
}

