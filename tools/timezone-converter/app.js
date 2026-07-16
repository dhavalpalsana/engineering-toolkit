document.addEventListener("DOMContentLoaded", () => {
  // Predefined major timezones list
  const timezoneOptions = [
    { value: "Local Time", label: "Local Time (Browser)" },
    { value: "UTC", label: "UTC / GMT (Universal Coordinated Time)" },
    { value: "America/Los_Angeles", label: "US Pacific Time (PST/PDT)" },
    { value: "America/Denver", label: "US Mountain Time (MST/MDT)" },
    { value: "America/Chicago", label: "US Central Time (CST/CDT)" },
    { value: "America/New_York", label: "US Eastern Time (EST/EDT)" },
    { value: "Europe/London", label: "London (GMT/BST)" },
    { value: "Europe/Paris", label: "Paris / Berlin (CET/CEST)" },
    { value: "Europe/Moscow", label: "Moscow (MSK)" },
    { value: "Asia/Kolkata", label: "India Standard Time (IST)" },
    { value: "Asia/Singapore", label: "Singapore Time (SGT)" },
    { value: "Asia/Tokyo", label: "Japan Standard Time (JST)" },
    { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
    { value: "Pacific/Auckland", label: "Auckland (NZST/NZDT)" }
  ];

  // Local State
  let selectedTimezones = ["Local Time", "UTC", "America/New_York", "America/Chicago", "America/Los_Angeles", "Asia/Shanghai", "Asia/Kolkata"];
  let anchorDate = new Date(); // Anchor UTC datetime object

  // DOM Selection
  const dateSelect = document.getElementById("date-select");
  const timeSelect = document.getElementById("time-select");
  const currentTimeBtn = document.getElementById("current-time-btn");
  const julianDateInput = document.getElementById("julian-date-input");
  const mjdInput = document.getElementById("mjd-input");
  const timezoneSearch = document.getElementById("timezone-search");
  const timelinesContainer = document.getElementById("timelines-container");
  const resetSetupBtn = document.getElementById("reset-setup-btn");
  const yydddInput = document.getElementById("yyddd-input");
  const yyyydddInput = document.getElementById("yyyyddd-input");
  const jdnInput = document.getElementById("jdn-input");
  const cyydddInput = document.getElementById("cyyddd-input");
  const ampmToggle = document.getElementById("ampm-toggle");

  // Initialize Lucide Icons
  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }

  // ── Timezone Select Initializer ──────────────────────────────
  const populateTimezoneSearch = () => {
    timezoneOptions.forEach(tz => {
      const option = document.createElement("option");
      option.value = tz.value;
      option.textContent = tz.label;
      timezoneSearch.appendChild(option);
    });
  };

  timezoneSearch.addEventListener("change", () => {
    const val = timezoneSearch.value;
    if (val && !selectedTimezones.includes(val)) {
      selectedTimezones.push(val);
      renderTimelines();
      updateAllInputs();
      document.dispatchEvent(new Event("change", { bubbles: true }));
    }
    timezoneSearch.value = ""; // Reset select
  });

  // ── Math: Julian Date / MJD Conversions ───────────────────────
  const dateToJulian = (date) => {
    let year = date.getUTCFullYear();
    let month = date.getUTCMonth() + 1;
    let day = date.getUTCDate();
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const seconds = date.getUTCSeconds();
    const ms = date.getUTCMilliseconds();

    if (month <= 2) {
      year -= 1;
      month += 12;
    }

    const A = Math.floor(year / 100);
    const B = Math.floor(A / 4);
    const C = 2 - A + B;
    const E = Math.floor(365.25 * (year + 4716));
    const F = Math.floor(30.6001 * (month + 1));
    
    // Decimal day fraction
    const dayDecimal = day + (hours + minutes / 60 + (seconds + ms / 1000) / 3600) / 24;

    return C + dayDecimal + E + F - 1524.5;
  };

  const julianToDate = (jd) => {
    const jdAdjusted = jd + 0.5;
    const Z = Math.floor(jdAdjusted);
    const F = jdAdjusted - Z;

    let A = Z;
    if (Z >= 2299161) {
      const alpha = Math.floor((Z - 1867216.25) / 36524.25);
      A = Z + 1 + alpha - Math.floor(alpha / 4);
    }

    const B = A + 1524;
    const C = Math.floor((B - 122.1) / 365.25);
    const D = Math.floor(365.25 * C);
    const E = Math.floor((B - D) / 30.6001);

    const dayDecimal = B - D - Math.floor(30.6001 * E) + F;
    const day = Math.floor(dayDecimal);

    const month = E < 14 ? E - 1 : E - 13;
    const year = month > 2 ? C - 4716 : C - 4715;

    const hourDecimal = (dayDecimal - day) * 24;
    const hours = Math.floor(hourDecimal);
    const minuteDecimal = (hourDecimal - hours) * 60;
    const minutes = Math.floor(minuteDecimal);
    const secondDecimal = (minuteDecimal - minutes) * 60;
    const seconds = Math.floor(secondDecimal);
    const ms = Math.round((secondDecimal - seconds) * 1000);

    // Date object created in UTC
    return new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, ms));
  };

  const dateToMJD = (date) => {
    return dateToJulian(date) - 2400000.5;
  };

  const mjdToDate = (mjd) => {
    return julianToDate(mjd + 2400000.5);
  };

  const dateToOrdinal = (date) => {
    const y = date.getUTCFullYear();
    const start = Date.UTC(y, 0, 0);
    const diff = date.getTime() - start;
    const oneDay = 1000 * 60 * 60 * 24;
    const ddd = Math.floor(diff / oneDay);
    
    const yy = String(y).slice(-2);
    const dddStr = String(ddd).padStart(3, "0");
    const C = Math.floor(y / 100) - 19;
    
    return {
      yyddd: yy + dddStr,
      yyyyddd: String(y) + dddStr,
      cyyddd: String(C) + yy + dddStr
    };
  };

  const ordinalToDate = (str) => {
    const clean = str.trim().replace(/\D/g, ""); // digits only
    let y, ddd;
    if (clean.length === 5) {
      const yy = parseInt(clean.slice(0, 2));
      ddd = parseInt(clean.slice(2));
      y = yy > 80 ? 1900 + yy : 2000 + yy;
    } else if (clean.length === 6) {
      const C = parseInt(clean[0]);
      const yy = parseInt(clean.slice(1, 3));
      ddd = parseInt(clean.slice(3));
      y = (19 + C) * 100 + yy;
    } else if (clean.length === 7) {
      y = parseInt(clean.slice(0, 4));
      ddd = parseInt(clean.slice(4));
    } else {
      return null;
    }
    
    if (isNaN(y) || isNaN(ddd) || ddd < 1 || ddd > 366) return null;
    
    const date = new Date(Date.UTC(y, 0, 1));
    date.setUTCDate(ddd);
    return date;
  };

  // ── Time offsets and Calculations ────────────────────────────
  const getTimezoneOffsetMinutes = (date, timezone) => {
    if (timezone === "Local Time") {
      return -date.getTimezoneOffset(); // browser offset in minutes
    }
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: false
      });

      const parts = formatter.formatToParts(date);
      const d = {};
      parts.forEach(p => { d[p.type] = p.value; });

      const tzLocal = Date.UTC(
        parseInt(d.year),
        parseInt(d.month) - 1,
        parseInt(d.day),
        parseInt(d.hour) === 24 ? 0 : parseInt(d.hour),
        parseInt(d.minute),
        parseInt(d.second)
      );

      const utcLocal = Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds()
      );

      return Math.round((tzLocal - utcLocal) / 60000);
    } catch (e) {
      console.warn(`Timezone format error for ${timezone}:`, e);
      return 0;
    }
  };

  // ── Sync UI inputs ───────────────────────────────────────────
  const updateAllInputs = () => {
    // 1. Calendar Inputs
    const yyyy = anchorDate.getUTCFullYear();
    const mm = String(anchorDate.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(anchorDate.getUTCDate()).padStart(2, "0");
    dateSelect.value = `${yyyy}-${mm}-${dd}`;

    const hh = String(anchorDate.getUTCHours()).padStart(2, "0");
    const min = String(anchorDate.getUTCMinutes()).padStart(2, "0");
    const ss = String(anchorDate.getUTCSeconds()).padStart(2, "0");
    timeSelect.value = `${hh}:${min}:${ss}`;

    // 2. Julian date inputs
    const jd = dateToJulian(anchorDate);
    julianDateInput.value = jd.toFixed(6);
    if (jdnInput) jdnInput.value = Math.floor(jd);
    mjdInput.value = dateToMJD(anchorDate).toFixed(6);

    const ord = dateToOrdinal(anchorDate);
    if (yydddInput) yydddInput.value = ord.yyddd;
    if (cyydddInput) cyydddInput.value = ord.cyyddd;
    if (yyyydddInput) yyyydddInput.value = ord.yyyyddd;

    // 3. Slider thumbs positions & Time labels
    selectedTimezones.forEach(tz => {
      const offset = getTimezoneOffsetMinutes(anchorDate, tz);
      // Local minutes in that timezone
      const localTimeMs = anchorDate.getTime() + offset * 60000;
      const localDate = new Date(localTimeMs);
      
      const hr = localDate.getUTCHours();
      const mn = localDate.getUTCMinutes();
      const sliderVal = hr * 60 + mn;

      // Update input slider
      const slider = document.getElementById(`slider-${tz}`);
      if (slider) slider.value = sliderVal;

      // Update text representation
      const textLabel = document.getElementById(`time-label-${tz}`);
      if (textLabel) {
        if (ampmToggle && ampmToggle.checked) {
          const displayHr = hr % 12 === 0 ? 12 : hr % 12;
          const displayMn = String(mn).padStart(2, "0");
          const ampm = hr >= 12 ? "PM" : "AM";
          textLabel.textContent = `${displayHr}:${displayMn} ${ampm}`;
        } else {
          const displayHr = String(hr).padStart(2, "0");
          const displayMn = String(mn).padStart(2, "0");
          textLabel.textContent = `${displayHr}:${displayMn}`;
        }
      }

      // Update offset metadata labels
      const offsetMeta = document.getElementById(`offset-${tz}`);
      if (offsetMeta) {
        const offsetHrs = (offset / 60).toFixed(1).replace(".0", "");
        offsetMeta.textContent = offset >= 0 ? `UTC+${offsetHrs}` : `UTC${offsetHrs}`;
      }
    });
  };

  // ── Render Timelines list ─────────────────────────────────────
  const renderTimelines = () => {
    timelinesContainer.innerHTML = "";

    selectedTimezones.forEach(tz => {
      const row = document.createElement("div");
      row.className = "timeline-row";
      row.id = `row-${tz}`;

      // Find timezone label
      const match = timezoneOptions.find(o => o.value === tz);
      const label = match ? match.label.split(" (")[0] : tz.split("/").pop().replace(/_/g, " ");

      row.innerHTML = `
        <div class="timezone-info">
          <div class="tz-row-header">
            <span class="timezone-name" title="${tz}">${label}</span>
            ${tz !== "UTC" && tz !== "Local Time" ? `
              <button class="remove-tz-btn" data-tz="${tz}" title="Remove timezone">
                <i data-lucide="x" style="width: 12px; height: 12px;"></i>
              </button>
            ` : ""}
          </div>
          <span class="timezone-offset" id="offset-${tz}">UTC+0</span>
          <span class="timezone-time" id="time-label-${tz}">00:00</span>
        </div>
        
        <div class="timeline-slider-container">
          <!-- The visual day/night segments -->
          <div class="timeline-track-background"></div>
          
          <!-- Faint vertical grid lines -->
          <div class="timeline-grid-lines">
            <div class="grid-line" style="left: 12.5%;"></div>
            <div class="grid-line" style="left: 25%;"></div>
            <div class="grid-line" style="left: 37.5%;"></div>
            <div class="grid-line" style="left: 50%;"></div>
            <div class="grid-line" style="left: 62.5%;"></div>
            <div class="grid-line" style="left: 75%;"></div>
            <div class="grid-line" style="left: 87.5%;"></div>
          </div>
          
          <!-- Transparent range slider -->
          <input type="range" id="slider-${tz}" class="timeline-slider-input" min="0" max="1439" value="0" />
        </div>
      `;

      // Slider Drag listener
      row.querySelector(".timeline-slider-input").addEventListener("input", (e) => {
        const targetLocalMinutes = parseInt(e.target.value);
        
        // Convert local minutes to UTC
        const offset = getTimezoneOffsetMinutes(anchorDate, tz);
        
        // Get the exact local date components for this timezone so we don't jump days
        let year, month, day;
        if (tz === "Local Time") {
          year = anchorDate.getFullYear();
          month = anchorDate.getMonth();
          day = anchorDate.getDate();
        } else {
          try {
            const formatter = new Intl.DateTimeFormat("en-US", {
              timeZone: tz,
              year: "numeric",
              month: "numeric",
              day: "numeric"
            });
            const parts = formatter.formatToParts(anchorDate);
            const d = {};
            parts.forEach(p => { d[p.type] = p.value; });
            year = parseInt(d.year);
            month = parseInt(d.month) - 1;
            day = parseInt(d.day);
          } catch (err) {
            // Fallback to local browser date
            year = anchorDate.getFullYear();
            month = anchorDate.getMonth();
            day = anchorDate.getDate();
          }
        }
        
        // Construct the start of that local day (00:00) in UTC
        const newDate = new Date(Date.UTC(year, month, day, 0, 0, 0));
        
        // Subtract timezone offset and add target local minutes to get new UTC timestamp
        const utcMinutes = targetLocalMinutes - offset;
        newDate.setUTCMinutes(newDate.getUTCMinutes() + utcMinutes);
        
        anchorDate = newDate;
        updateAllInputs();
        document.dispatchEvent(new Event("change", { bubbles: true }));
      });

      // Remove row handler
      const removeBtn = row.querySelector(".remove-tz-btn");
      if (removeBtn) {
        removeBtn.addEventListener("click", () => {
          selectedTimezones = selectedTimezones.filter(item => item !== tz);
          renderTimelines();
          updateAllInputs();
          document.dispatchEvent(new Event("change", { bubbles: true }));
        });
      }

      timelinesContainer.appendChild(row);
    });

    if (typeof lucide !== "undefined") {
      lucide.createIcons();
    }
  };

  // ── Inputs Event Listeners ───────────────────────────────────
  
  // Date Picker change
  dateSelect.addEventListener("change", () => {
    const val = dateSelect.value;
    if (!val) return;
    const parts = val.split("-");
    const y = parseInt(parts[0]);
    const m = parseInt(parts[1]) - 1;
    const d = parseInt(parts[2]);

    const newDate = new Date(anchorDate);
    newDate.setUTCFullYear(y);
    newDate.setUTCMonth(m);
    newDate.setUTCDate(d);

    anchorDate = newDate;
    updateAllInputs();
    document.dispatchEvent(new Event("change", { bubbles: true }));
  });

  // Time Picker change
  timeSelect.addEventListener("change", () => {
    const val = timeSelect.value;
    if (!val) return;
    const parts = val.split(":");
    const h = parseInt(parts[0]);
    const m = parseInt(parts[1]);
    const s = parts[2] ? parseInt(parts[2]) : 0;

    const newDate = new Date(anchorDate);
    newDate.setUTCHours(h, m, s, 0);

    anchorDate = newDate;
    updateAllInputs();
    document.dispatchEvent(new Event("change", { bubbles: true }));
  });

  // Julian Date Manual Input
  julianDateInput.addEventListener("change", () => {
    const val = parseFloat(julianDateInput.value);
    if (isNaN(val)) return;
    anchorDate = julianToDate(val);
    updateAllInputs();
    document.dispatchEvent(new Event("change", { bubbles: true }));
  });

  // MJD Manual Input
  mjdInput.addEventListener("change", () => {
    const val = parseFloat(mjdInput.value);
    if (isNaN(val)) return;
    anchorDate = mjdToDate(val);
    updateAllInputs();
    document.dispatchEvent(new Event("change", { bubbles: true }));
  });

  // Ordinal Date (YYDDD) input listener
  if (yydddInput) {
    yydddInput.addEventListener("input", () => {
      const val = yydddInput.value;
      if (val.length === 5) {
        const parsed = ordinalToDate(val);
        if (parsed) {
          anchorDate = parsed;
          updateAllInputs();
          document.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    });
  }

  // Ordinal Date (YYYYDDD) input listener
  if (yyyydddInput) {
    yyyydddInput.addEventListener("input", () => {
      const val = yyyydddInput.value;
      if (val.length === 7) {
        const parsed = ordinalToDate(val);
        if (parsed) {
          anchorDate = parsed;
          updateAllInputs();
          document.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    });
  }

  // ERP Julian Date (CYYDDD) input listener
  if (cyydddInput) {
    cyydddInput.addEventListener("input", () => {
      const val = cyydddInput.value;
      if (val.length === 6) {
        const parsed = ordinalToDate(val);
        if (parsed) {
          anchorDate = parsed;
          updateAllInputs();
          document.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    });
  }

  // Julian Day Number (JDN) input listener
  if (jdnInput) {
    jdnInput.addEventListener("change", () => {
      const val = parseInt(jdnInput.value);
      if (isNaN(val)) return;
      anchorDate = julianToDate(val);
      updateAllInputs();
      document.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  const updateRulerHours = () => {
    const ruler = document.querySelector(".hours-ruler");
    if (!ruler) return;
    if (ampmToggle && ampmToggle.checked) {
      ruler.innerHTML = `
        <span>12 AM</span>
        <span>3 AM</span>
        <span>6 AM</span>
        <span>9 AM</span>
        <span>12 PM</span>
        <span>3 PM</span>
        <span>6 PM</span>
        <span>9 PM</span>
        <span>12 AM</span>
      `;
    } else {
      ruler.innerHTML = `
        <span>00h</span>
        <span>03h</span>
        <span>06h</span>
        <span>09h</span>
        <span>12h</span>
        <span>15h</span>
        <span>18h</span>
        <span>21h</span>
        <span>24h</span>
      `;
    }
  };

  if (ampmToggle) {
    ampmToggle.addEventListener("change", () => {
      updateRulerHours();
      updateAllInputs();
      document.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  // Sync to Current Time
  currentTimeBtn.addEventListener("click", () => {
    anchorDate = new Date();
    updateAllInputs();
    document.dispatchEvent(new Event("change", { bubbles: true }));
    if (window.showToast) window.showToast("Synchronized to current UTC time.");
  });

  // Reset timelines list layout
  resetSetupBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to reset your timezone rows to default?")) {
      selectedTimezones = ["Local Time", "UTC", "America/New_York", "America/Chicago", "America/Los_Angeles", "Asia/Shanghai", "Asia/Kolkata"];
      anchorDate = new Date();
      renderTimelines();
      updateAllInputs();
      document.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });

  window.exportJSON = function() {
    const data = {
      selectedTimezones: selectedTimezones,
      currentTimestamp: anchorDate.getTime(),
      ampmMode: ampmToggle ? ampmToggle.checked : false
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `timezone-config-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  window.importJSON = function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const data = JSON.parse(evt.target.result);
        if (data && Array.isArray(data.selectedTimezones)) {
          selectedTimezones = data.selectedTimezones;
          if (data.currentTimestamp) {
            anchorDate = new Date(data.currentTimestamp);
          }
          if (ampmToggle) {
            ampmToggle.checked = !!data.ampmMode;
          }
          renderTimelines();
          updateRulerHours();
          updateAllInputs();
          document.dispatchEvent(new Event("change", { bubbles: true }));
          if (window.showToast) window.showToast("Setup imported successfully!");
        } else {
          alert("Invalid import format. JSON must contain selectedTimezones list.");
        }
      } catch (err) {
        alert("Failed to parse JSON file: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // Reset
  };

  window.shareLink = function() {
    try {
      const state = {
        selectedTimezones: selectedTimezones,
        currentTimestamp: anchorDate.getTime(),
        ampmMode: ampmToggle ? ampmToggle.checked : false
      };
      const serialized = (window.encodeShareState ? window.encodeShareState(state) : btoa(unescape(encodeURIComponent(JSON.stringify(state)))));
      const url = new URL(window.location.href);
      url.searchParams.set("design", serialized);
      
      navigator.clipboard.writeText(url.toString()).then(() => {
        if (window.showToast) window.showToast("Sharing link copied to clipboard!");
      });
    } catch (err) {
      console.error(err);
      if (window.showToast) window.showToast("Failed to create sharing link.", false);
    }
  };

  // ── Project Manager Integration ──────────────────────────────
  window.projectManagerConfig = {
    toolId: "timezone-converter",
    getInputs: () => {
      return {
        selectedTimezones: selectedTimezones,
        currentTimestamp: anchorDate.getTime(),
        ampmMode: ampmToggle ? ampmToggle.checked : false
      };
    },
    setInputs: (data) => {
      if (data && Array.isArray(data.selectedTimezones)) {
        selectedTimezones = data.selectedTimezones;
      }
      if (data && data.currentTimestamp) {
        anchorDate = new Date(data.currentTimestamp);
      }
      if (ampmToggle && data) {
        ampmToggle.checked = !!data.ampmMode;
      }
      renderTimelines();
      updateRulerHours();
      updateAllInputs();
    }
  };

  // ── Meeting Finder (overlap green zone) ─────────────────────
  const parseHHMM = (val, fallbackMinutes) => {
    if (!val || !val.includes(":")) return fallbackMinutes;
    const [h, m] = val.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const getLocalMinutesOnDate = (utcDate, tz) => {
    const offset = getTimezoneOffsetMinutes(utcDate, tz);
    const local = new Date(utcDate.getTime() + offset * 60000);
    return local.getUTCHours() * 60 + local.getUTCMinutes();
  };

  const findMeetingWindows = () => {
    const resultsEl = document.getElementById("meeting-results");
    if (!resultsEl) return;

    const workStart = parseHHMM(document.getElementById("meeting-work-start")?.value, 9 * 60);
    const workEnd = parseHHMM(document.getElementById("meeting-work-end")?.value, 17 * 60);
    const duration = parseInt(document.getElementById("meeting-duration")?.value, 10) || 60;

    if (workEnd <= workStart) {
      resultsEl.innerHTML = `<p style="color:var(--color-error,#ef4444)">Work end must be after work start.</p>`;
      return;
    }

    // Scan the reference UTC calendar day in 15-minute steps
    const dayStart = new Date(Date.UTC(
      anchorDate.getUTCFullYear(),
      anchorDate.getUTCMonth(),
      anchorDate.getUTCDate(),
      0, 0, 0, 0
    ));
    const windows = [];
    const step = 15;

    for (let utcMin = 0; utcMin <= 1440 - duration; utcMin += step) {
      const start = new Date(dayStart.getTime() + utcMin * 60000);
      const end = new Date(start.getTime() + duration * 60000);
      const ok = selectedTimezones.every(tz => {
        // Sample start + mid + end-1min so meetings don't straddle work hours incorrectly
        const samples = [0, Math.floor(duration / 2), duration - 1];
        return samples.every(dm => {
          const t = new Date(start.getTime() + dm * 60000);
          const lm = getLocalMinutesOnDate(t, tz);
          return lm >= workStart && lm < workEnd;
        });
      });
      if (ok) {
        windows.push({ start, end });
      }
    }

    // Merge contiguous windows
    const merged = [];
    windows.forEach(w => {
      const last = merged[merged.length - 1];
      if (last && w.start.getTime() <= last.end.getTime() + step * 60000) {
        last.end = w.end > last.end ? w.end : last.end;
      } else {
        merged.push({ start: w.start, end: w.end });
      }
    });

    if (merged.length === 0) {
      resultsEl.innerHTML = `<p style="color:var(--text-muted)">No full overlap on this UTC day for the selected zones and work hours. Try widening work hours or fewer zones.</p>`;
      return;
    }

    const fmtUtc = (d) => {
      const hh = String(d.getUTCHours()).padStart(2, "0");
      const mm = String(d.getUTCMinutes()).padStart(2, "0");
      return `${hh}:${mm} UTC`;
    };

    resultsEl.innerHTML = `
      <div style="font-weight:700;margin-bottom:6px;color:var(--text-primary)">
        ${merged.length} overlap window(s) · ${selectedTimezones.length} zones
      </div>
      <ul style="margin:0;padding-left:18px;line-height:1.5;color:var(--text-secondary)">
        ${merged.slice(0, 12).map(w => {
          const mins = Math.round((w.end - w.start) / 60000);
          return `<li><strong>${fmtUtc(w.start)}</strong> – ${fmtUtc(w.end)} <span style="color:var(--text-muted)">(${mins} min span)</span>
            <button type="button" class="meeting-jump-btn" data-ts="${w.start.getTime()}" style="margin-left:6px;font-size:11px;cursor:pointer;border:1px solid var(--border-color);background:var(--bg-tertiary);border-radius:6px;padding:1px 6px;">Jump</button>
          </li>`;
        }).join("")}
      </ul>
      ${merged.length > 12 ? `<p style="color:var(--text-muted);margin-top:6px">Showing first 12 of ${merged.length}.</p>` : ""}
    `;

    resultsEl.querySelectorAll(".meeting-jump-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        anchorDate = new Date(parseInt(btn.getAttribute("data-ts"), 10));
        updateAllInputs();
        document.dispatchEvent(new Event("change", { bubbles: true }));
        if (window.showToast) window.showToast("Timeline jumped to meeting start.");
      });
    });
  };

  const exportIcs = () => {
    const duration = parseInt(document.getElementById("meeting-duration")?.value, 10) || 60;
    const start = new Date(anchorDate.getTime());
    const end = new Date(start.getTime() + duration * 60000);

    const toIcsUtc = (d) => {
      const y = d.getUTCFullYear();
      const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
      const da = String(d.getUTCDate()).padStart(2, "0");
      const hh = String(d.getUTCHours()).padStart(2, "0");
      const mm = String(d.getUTCMinutes()).padStart(2, "0");
      const ss = String(d.getUTCSeconds()).padStart(2, "0");
      return `${y}${mo}${da}T${hh}${mm}${ss}Z`;
    };

    const zoneList = selectedTimezones.join(", ");
    const uid = `eng-toolkit-${start.getTime()}@eng-toolkit.web.app`;
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Engineering Toolkit//Timezone Planner//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${toIcsUtc(new Date())}`,
      `DTSTART:${toIcsUtc(start)}`,
      `DTEND:${toIcsUtc(end)}`,
      "SUMMARY:Cross-timezone meeting (Engineering Toolkit)",
      `DESCRIPTION:Planned via Engineering Toolkit Timezone Converter. Zones: ${zoneList.replace(/,/g, "\\,")}`,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meeting-${toIcsUtc(start)}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (window.showToast) window.showToast("ICS calendar file downloaded.");
  };

  document.getElementById("find-meetings-btn")?.addEventListener("click", findMeetingWindows);
  document.getElementById("export-ics-btn")?.addEventListener("click", exportIcs);
  ["meeting-work-start", "meeting-work-end", "meeting-duration"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", () => {
      const el = document.getElementById("meeting-results");
      if (el && el.innerHTML.trim()) findMeetingWindows();
    });
  });

  // Run Initializations
  populateTimezoneSearch();
  
  // Parse shared URL design if present
  const urlParams = new URLSearchParams(window.location.search);
  const designParam = urlParams.get("design");
  let loadedFromUrl = false;
  if (designParam) {
    try {
      const decoded = (window.decodeShareState ? window.decodeShareState(designParam) : JSON.parse(decodeURIComponent(escape(atob(designParam)))));
      window.projectManagerConfig.setInputs(decoded);
      loadedFromUrl = true;
    } catch (err) {
      console.error("Failed to parse design from URL:", err);
    }
  }
  
  if (!loadedFromUrl) {
    renderTimelines();
    updateRulerHours();
    updateAllInputs();
  }

  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }
});

// Platform export menu (standard JSON/import; tool-specific formats may already live in body UI)
if (window.ToolExports) {
  window.ToolExports.register({
    json: () => window.exportJSON(),
    import: () => document.getElementById("import-file-input")?.click(),
    ics: () => document.getElementById("export-ics-btn")?.click(),
    hide: ["[data-et-export-ui]", "#export-ics-btn"]
  });
  window.ToolExports.mount();
}
