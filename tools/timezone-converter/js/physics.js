/**
 * Timezone & Astronomical Date Conversions (pure UMD, browser + Node).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TimezonePhysics = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const physicsVersion = 1;

  /**
   * Convert JavaScript Date to Julian Date (JD).
   * Reference: Standard Meeus Astronomical Algorithms.
   */
  function dateToJulian(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return NaN;
    let year = date.getUTCFullYear();
    let month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
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
  }

  /**
   * Convert Julian Date (JD) back to UTC Date object.
   */
  function julianToDate(jd) {
    if (typeof jd !== 'number' || isNaN(jd)) return null;
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

    return new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, ms));
  }

  /**
   * Convert JavaScript Date to Modified Julian Date (MJD).
   * MJD = JD - 2400000.5 (starts at midnight instead of noon).
   */
  function dateToMJD(date) {
    const jd = dateToJulian(date);
    if (isNaN(jd)) return NaN;
    return jd - 2400000.5;
  }

  /**
   * Convert Modified Julian Date (MJD) back to Date.
   */
  function mjdToDate(mjd) {
    if (typeof mjd !== 'number' || isNaN(mjd)) return null;
    return julianToDate(mjd + 2400000.5);
  }

  /**
   * Extract ordinal formats: YYDDD, YYYYDDD, and CYYDDD.
   */
  function dateToOrdinal(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return null;
    const y = date.getUTCFullYear();
    const start = Date.UTC(y, 0, 0);
    const diff = date.getTime() - start;
    const oneDay = 1000 * 60 * 60 * 24;
    const ddd = Math.floor(diff / oneDay);

    const yy = String(y).slice(-2);
    const dddStr = String(ddd).padStart(3, '0');
    const C = Math.floor(y / 100) - 19;

    return {
      yyddd: yy + dddStr,
      yyyyddd: String(y) + dddStr,
      cyyddd: String(C) + yy + dddStr,
      dayOfYear: ddd
    };
  }

  /**
   * Parse ordinal string (YYDDD, YYYYDDD, or CYYDDD) into UTC Date.
   */
  function ordinalToDate(str) {
    if (!str || typeof str !== 'string') return null;
    const clean = str.trim().replace(/\D/g, '');
    let y, ddd;
    if (clean.length === 5) {
      const yy = parseInt(clean.slice(0, 2), 10);
      ddd = parseInt(clean.slice(2), 10);
      y = yy > 80 ? 1900 + yy : 2000 + yy;
    } else if (clean.length === 6) {
      const C = parseInt(clean[0], 10);
      const yy = parseInt(clean.slice(1, 3), 10);
      ddd = parseInt(clean.slice(3), 10);
      y = (19 + C) * 100 + yy;
    } else if (clean.length === 7) {
      y = parseInt(clean.slice(0, 4), 10);
      ddd = parseInt(clean.slice(4), 10);
    } else {
      return null;
    }

    if (isNaN(y) || isNaN(ddd) || ddd < 1 || ddd > 366) return null;

    const date = new Date(Date.UTC(y, 0, 1));
    date.setUTCDate(ddd);
    return date;
  }

  /**
   * Calculate timezone offset in minutes for a given date.
   */
  function getTimezoneOffsetMinutes(date, timezone) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return 0;
    if (!timezone || timezone === 'Local Time') {
      return -date.getTimezoneOffset();
    }
    if (timezone === 'UTC' || timezone === 'GMT') {
      return 0;
    }
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false
      });

      const parts = formatter.formatToParts(date);
      const d = {};
      parts.forEach((p) => { d[p.type] = p.value; });

      const tzLocal = Date.UTC(
        parseInt(d.year, 10),
        parseInt(d.month, 10) - 1,
        parseInt(d.day, 10),
        parseInt(d.hour === '24' ? '0' : d.hour, 10),
        parseInt(d.minute, 10),
        parseInt(d.second, 10)
      );

      return Math.round((tzLocal - date.getTime()) / (60 * 1000));
    } catch (_) {
      return 0;
    }
  }

  return {
    physicsVersion,
    dateToJulian,
    julianToDate,
    dateToMJD,
    mjdToDate,
    dateToOrdinal,
    ordinalToDate,
    getTimezoneOffsetMinutes
  };
});
