// ============================================================
  //  UNIT DATABASE  — 23 Categories
  //  Linear units: factor = multiplier to base SI unit
  //  Temperature: special toBase / fromBase functions
  // ============================================================
  const GROUPS = [
    { label: 'Mechanics', ids: ['acceleration','area','density','force','frequency','length','stress','time','torque','velocity','volume','volume_flow'] },
    { label: 'Thermodynamics', ids: ['energy','heat_flux','heat_transfer','power','specific_heat','temperature','thermal_cond'] },
    { label: 'Fluids', ids: ['massflow','viscosity_dyn','viscosity_kin'] },
    { label: 'Electrical', ids: ['current','voltage'] },
  ];

  const CATEGORIES = [
    // -------- MECHANICS --------
    {
      id: 'acceleration', name: 'Acceleration', group: 'Mechanics',
      icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
      baseSymbol: 'm/s²',
      units: [
        { name: 'Metre/second²',      symbol: 'm/s²',   factor: 1 },
        { name: 'Foot/second²',       symbol: 'ft/s²',  factor: 0.3048 },
        { name: 'Inch/second²',       symbol: 'in/s²',  factor: 0.0254 },
        { name: 'Standard gravity',   symbol: 'g₀',     factor: 9.80665 },
        { name: 'Gal (cm/s²)',        symbol: 'Gal',    factor: 0.01 },
        { name: 'km/h per second',    symbol: 'km/h·s', factor: 0.27778 },
        { name: 'mph per second',     symbol: 'mph/s',  factor: 0.44704 },
        { name: 'Millig (10⁻³ g)',    symbol: 'mg',     factor: 0.00980665 },
      ]
    },
    {
      id: 'area', name: 'Area', group: 'Mechanics',
      icon: 'M3 3h18v18H3z',
      baseSymbol: 'm²',
      units: [
        { name: 'Square metre',        symbol: 'm²',     factor: 1 },
        { name: 'Square kilometre',    symbol: 'km²',    factor: 1e6 },
        { name: 'Square centimetre',   symbol: 'cm²',    factor: 1e-4 },
        { name: 'Square millimetre',   symbol: 'mm²',    factor: 1e-6 },
        { name: 'Square foot',         symbol: 'ft²',    factor: 0.09290304 },
        { name: 'Square inch',         symbol: 'in²',    factor: 6.4516e-4 },
        { name: 'Square yard',         symbol: 'yd²',    factor: 0.83612736 },
        { name: 'Square mile',         symbol: 'mi²',    factor: 2.589988e6 },
        { name: 'Hectare',             symbol: 'ha',     factor: 1e4 },
        { name: 'Acre',                symbol: 'ac',     factor: 4046.856 },
      ]
    },
    {
      id: 'density', name: 'Density', group: 'Mechanics',
      icon: 'M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z',
      baseSymbol: 'kg/m³',
      units: [
        { name: 'Kilogram/cubic metre', symbol: 'kg/m³',         factor: 1 },
        { name: 'Gram/cubic centimetre',symbol: 'g/cm³',         factor: 1000 },
        { name: 'Kilogram/litre',       symbol: 'kg/L',          factor: 1000 },
        { name: 'Pound/cubic foot',     symbol: 'lb/ft³',        factor: 16.01845 },
        { name: 'Pound/cubic inch',     symbol: 'lb/in³',        factor: 27679.90 },
        { name: 'Pound/gallon (US)',    symbol: 'lb/gal(US)',    factor: 119.8264 },
        { name: 'Pound/gallon (UK)',    symbol: 'lb/gal(UK)',    factor: 99.7764 },
        { name: 'Slug/cubic foot',      symbol: 'slug/ft³',      factor: 515.3788 },
        { name: 'Ounce/gallon (US)',    symbol: 'oz/gal(US)',    factor: 7.4892 },
        { name: 'Gram/litre',          symbol: 'g/L',           factor: 1 },
      ]
    },
    {
      id: 'force', name: 'Force', group: 'Mechanics',
      icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
      baseSymbol: 'N',
      units: [
        { name: 'Newton',              symbol: 'N',      factor: 1 },
        { name: 'Kilonewton',          symbol: 'kN',     factor: 1000 },
        { name: 'Meganewton',          symbol: 'MN',     factor: 1e6 },
        { name: 'Millinewton',         symbol: 'mN',     factor: 0.001 },
        { name: 'kgf (kilopond)',      symbol: 'kgf',    factor: 9.80665 },
        { name: 'Pound-force',         symbol: 'lbf',    factor: 4.44822 },
        { name: 'Kilopound-force',     symbol: 'kip',    factor: 4448.22 },
        { name: 'Ounce-force',         symbol: 'ozf',    factor: 0.27801 },
        { name: 'Poundal',             symbol: 'pdl',    factor: 0.13826 },
        { name: 'Dyne',                symbol: 'dyn',    factor: 1e-5 },
      ]
    },
    {
      id: 'frequency', name: 'Frequency', group: 'Mechanics',
      icon: 'M2 12h4l3-9 4 18 3-9h6',
      baseSymbol: 'Hz',
      units: [
        { name: 'Hertz',           symbol: 'Hz',   factor: 1 },
        { name: 'Kilohertz',       symbol: 'kHz',  factor: 1e3 },
        { name: 'Megahertz',       symbol: 'MHz',  factor: 1e6 },
        { name: 'Gigahertz',       symbol: 'GHz',  factor: 1e9 },
        { name: 'RPM',             symbol: 'rpm',  factor: 1/60 },
        { name: 'RPS',             symbol: 'rps',  factor: 1 },
        { name: 'Millihertz',      symbol: 'mHz',  factor: 0.001 },
        { name: 'Terahertz',       symbol: 'THz',  factor: 1e12 },
      ]
    },
    {
      id: 'length', name: 'Length', group: 'Mechanics',
      icon: 'M3 12h18M3 6h18M3 18h18',
      baseSymbol: 'm',
      units: [
        { name: 'Metre',           symbol: 'm',    factor: 1 },
        { name: 'Kilometre',       symbol: 'km',   factor: 1000 },
        { name: 'Centimetre',      symbol: 'cm',   factor: 0.01 },
        { name: 'Millimetre',      symbol: 'mm',   factor: 0.001 },
        { name: 'Micrometre',      symbol: 'µm',   factor: 1e-6 },
        { name: 'Nanometre',       symbol: 'nm',   factor: 1e-9 },
        { name: 'Angstrom',        symbol: 'Å',    factor: 1e-10 },
        { name: 'Inch',            symbol: 'in',   factor: 0.0254 },
        { name: 'Foot',            symbol: 'ft',   factor: 0.3048 },
        { name: 'Yard',            symbol: 'yd',   factor: 0.9144 },
        { name: 'Mile',            symbol: 'mi',   factor: 1609.344 },
        { name: 'Nautical Mile',   symbol: 'nmi',  factor: 1852 },
        { name: 'Fathom',          symbol: 'ftm',  factor: 1.8288 },
        { name: 'Light-year',      symbol: 'ly',   factor: 9.461e15 },
      ]
    },
    {
      id: 'stress', name: 'Stress', group: 'Mechanics',
      icon: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8zm-1-5h2v2h-2zm0-8h2v6h-2z',
      baseSymbol: 'Pa',
      units: [
        { name: 'Pascal',          symbol: 'Pa',      factor: 1 },
        { name: 'Kilopascal',      symbol: 'kPa',     factor: 1e3 },
        { name: 'Megapascal',      symbol: 'MPa',     factor: 1e6 },
        { name: 'N/mm²',          symbol: 'N/mm²',   factor: 1e6 },
        { name: 'GPa',             symbol: 'GPa',     factor: 1e9 },
        { name: 'Bar',             symbol: 'bar',     factor: 1e5 },
        { name: 'PSI',             symbol: 'psi',     factor: 6894.757 },
        { name: 'ksi',             symbol: 'ksi',     factor: 6894757 },
        { name: 'kgf/cm²',        symbol: 'kgf/cm²', factor: 98066.5 },
        { name: 'kgf/mm²',        symbol: 'kgf/mm²', factor: 9806650 },
        { name: 'lbf/in²',        symbol: 'lbf/in²', factor: 6894.757 },
      ]
    },
    {
      id: 'time', name: 'Time', group: 'Mechanics',
      icon: 'M12 22C6.48 22 2 17.52 2 12S6.48 2 12 2s10 4.48 10 10-4.48 10-10 10zm.5-10.5V7H11v5.5l4.25 2.55.75-1.23-3.5-2.32z',
      baseSymbol: 's',
      units: [
        { name: 'Second',          symbol: 's',    factor: 1 },
        { name: 'Millisecond',     symbol: 'ms',   factor: 0.001 },
        { name: 'Microsecond',     symbol: 'µs',   factor: 1e-6 },
        { name: 'Nanosecond',      symbol: 'ns',   factor: 1e-9 },
        { name: 'Minute',          symbol: 'min',  factor: 60 },
        { name: 'Hour',            symbol: 'h',    factor: 3600 },
        { name: 'Day',             symbol: 'day',  factor: 86400 },
        { name: 'Week',            symbol: 'wk',   factor: 604800 },
        { name: 'Month (avg)',     symbol: 'mo',   factor: 2629800 },
        { name: 'Year (avg)',      symbol: 'yr',   factor: 31557600 },
      ]
    },
    {
      id: 'torque', name: 'Torque', group: 'Mechanics',
      icon: 'M12 22V12m0 0C12 7 8 4 4 4m8 8c0-5 4-8 8-8',
      baseSymbol: 'N·m',
      units: [
        { name: 'Newton-metre',       symbol: 'N·m',     factor: 1 },
        { name: 'Kilonewton-metre',   symbol: 'kN·m',    factor: 1000 },
        { name: 'Millinewton-metre',  symbol: 'mN·m',    factor: 0.001 },
        { name: 'Foot-pound',         symbol: 'ft·lbf',  factor: 1.35582 },
        { name: 'Inch-pound',         symbol: 'in·lbf',  factor: 0.112985 },
        { name: 'Inch-ounce',         symbol: 'in·ozf',  factor: 0.00706155 },
        { name: 'kgf·m',             symbol: 'kgf·m',   factor: 9.80665 },
        { name: 'kgf·cm',            symbol: 'kgf·cm',  factor: 0.0980665 },
        { name: 'daN·m',             symbol: 'daN·m',   factor: 10 },
        { name: 'oz·in',             symbol: 'oz·in',   factor: 0.00706155 },
      ]
    },
    {
      id: 'velocity', name: 'Velocity / Speed', group: 'Mechanics',
      icon: 'M5 12h14M12 5l7 7-7 7',
      baseSymbol: 'm/s',
      units: [
        { name: 'Metre/second',    symbol: 'm/s',   factor: 1 },
        { name: 'Kilometre/hour',  symbol: 'km/h',  factor: 0.277778 },
        { name: 'Mile/hour',       symbol: 'mph',   factor: 0.44704 },
        { name: 'Foot/second',     symbol: 'ft/s',  factor: 0.3048 },
        { name: 'Foot/minute',     symbol: 'ft/min',factor: 0.00508 },
        { name: 'Knot',            symbol: 'kn',    factor: 0.514444 },
        { name: 'Mach (at sea level, 15°C)',symbol: 'Mach',factor: 340.29 },
        { name: 'cm/s',            symbol: 'cm/s',  factor: 0.01 },
        { name: 'mm/s',            symbol: 'mm/s',  factor: 0.001 },
        { name: 'in/s',            symbol: 'in/s',  factor: 0.0254 },
      ]
    },
    {
      id: 'volume', name: 'Volume', group: 'Mechanics',
      icon: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
      baseSymbol: 'm³',
      units: [
        { name: 'Cubic metre',        symbol: 'm³',          factor: 1 },
        { name: 'Litre',              symbol: 'L',           factor: 0.001 },
        { name: 'Millilitre',         symbol: 'mL',          factor: 1e-6 },
        { name: 'Cubic centimetre',   symbol: 'cm³',         factor: 1e-6 },
        { name: 'Cubic foot',         symbol: 'ft³',         factor: 0.028317 },
        { name: 'Cubic inch',         symbol: 'in³',         factor: 1.6387e-5 },
        { name: 'US Gallon',          symbol: 'gal (US)',    factor: 0.003785 },
        { name: 'UK Gallon',          symbol: 'gal (UK)',    factor: 0.004546 },
        { name: 'US Fluid Ounce',     symbol: 'fl oz (US)',  factor: 2.9574e-5 },
        { name: 'US Barrel (oil)',     symbol: 'bbl',         factor: 0.158987 },
        { name: 'US Quart',           symbol: 'qt (US)',     factor: 9.4635e-4 },
        { name: 'US Pint',            symbol: 'pt (US)',     factor: 4.7318e-4 },
        { name: 'Cubic kilometre',    symbol: 'km³',         factor: 1e9 },
        { name: 'Cubic millimetre',   symbol: 'mm³',         factor: 1e-9 },
      ]
    },
    {
      id: 'volume_flow', name: 'Volume Flow Rate', group: 'Mechanics',
      icon: 'M22 12h-4l-3 9L9 3l-3 9H2',
      baseSymbol: 'm³/s',
      units: [
        { name: 'Cubic metre/second', symbol: 'm³/s',    factor: 1 },
        { name: 'Litre/second',       symbol: 'L/s',     factor: 0.001 },
        { name: 'Litre/minute',       symbol: 'L/min',   factor: 1/60000 },
        { name: 'Litre/hour',         symbol: 'L/h',     factor: 1/3600000 },
        { name: 'Cubic metre/hour',   symbol: 'm³/h',    factor: 1/3600 },
        { name: 'Cubic metre/minute', symbol: 'm³/min',  factor: 1/60 },
        { name: 'US Gallon/min',      symbol: 'gpm',     factor: 6.3090e-5 },
        { name: 'US Gallon/hour',     symbol: 'gph',     factor: 1.0515e-6 },
        { name: 'Cubic foot/minute',  symbol: 'cfm',     factor: 4.7195e-4 },
        { name: 'Cubic foot/second',  symbol: 'cfs',     factor: 0.028317 },
        { name: 'Barrel/day (oil)',   symbol: 'bbl/d',   factor: 1.8401e-6 },
        { name: 'UK Gallon/min',      symbol: 'UK gpm',  factor: 7.5768e-5 },
      ]
    },

    // -------- THERMODYNAMICS --------
    {
      id: 'energy', name: 'Energy', group: 'Thermodynamics',
      icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
      baseSymbol: 'J',
      units: [
        { name: 'Joule',              symbol: 'J',       factor: 1 },
        { name: 'Kilojoule',          symbol: 'kJ',      factor: 1e3 },
        { name: 'Megajoule',          symbol: 'MJ',      factor: 1e6 },
        { name: 'Gigajoule',          symbol: 'GJ',      factor: 1e9 },
        { name: 'Calorie (IT)',       symbol: 'cal',     factor: 4.1868 },
        { name: 'Kilocalorie (kcal)', symbol: 'kcal',    factor: 4186.8 },
        { name: 'BTU (IT)',           symbol: 'BTU',     factor: 1055.06 },
        { name: 'Foot-pound-force',   symbol: 'ft·lbf',  factor: 1.35582 },
        { name: 'Watt-hour',          symbol: 'Wh',      factor: 3600 },
        { name: 'Kilowatt-hour',      symbol: 'kWh',     factor: 3.6e6 },
        { name: 'Megawatt-hour',      symbol: 'MWh',     factor: 3.6e9 },
        { name: 'Therm (US)',         symbol: 'thm',     factor: 1.055e8 },
        { name: 'eV',                 symbol: 'eV',      factor: 1.60218e-19 },
        { name: 'Erg',                symbol: 'erg',     factor: 1e-7 },
      ]
    },
    {
      id: 'heat_flux', name: 'Heat Flux', group: 'Thermodynamics',
      icon: 'M12 2v20M2 12h20',
      baseSymbol: 'W/m²',
      units: [
        { name: 'Watt/square metre',          symbol: 'W/m²',          factor: 1 },
        { name: 'Kilowatt/square metre',      symbol: 'kW/m²',         factor: 1000 },
        { name: 'BTU/(ft²·h)',                symbol: 'BTU/(ft²·h)',   factor: 3.15459 },
        { name: 'BTU/(ft²·min)',              symbol: 'BTU/(ft²·min)', factor: 189.275 },
        { name: 'kcal/(m²·h)',               symbol: 'kcal/(m²·h)',   factor: 1.163 },
        { name: 'kcal/(cm²·h)',              symbol: 'kcal/(cm²·h)',  factor: 11630 },
        { name: 'cal/(cm²·s)',               symbol: 'cal/(cm²·s)',   factor: 41868 },
        { name: 'W/cm²',                     symbol: 'W/cm²',         factor: 1e4 },
      ]
    },
    {
      id: 'heat_transfer', name: 'Heat Transfer Coeff.', group: 'Thermodynamics',
      icon: 'M17 12h-5v5h5v-5zM1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01',
      baseSymbol: 'W/(m²·K)',
      units: [
        { name: 'W/(m²·K)',            symbol: 'W/(m²·K)',          factor: 1 },
        { name: 'W/(m²·°C)',           symbol: 'W/(m²·°C)',         factor: 1 },
        { name: 'kW/(m²·K)',           symbol: 'kW/(m²·K)',         factor: 1000 },
        { name: 'BTU/(h·ft²·°F)',      symbol: 'BTU/(h·ft²·°F)',   factor: 5.67826 },
        { name: 'BTU/(s·ft²·°F)',      symbol: 'BTU/(s·ft²·°F)',   factor: 20441.7 },
        { name: 'kcal/(h·m²·°C)',     symbol: 'kcal/(h·m²·°C)',   factor: 1.163 },
        { name: 'cal/(s·cm²·°C)',     symbol: 'cal/(s·cm²·°C)',   factor: 41868 },
      ]
    },
    {
      id: 'power', name: 'Power', group: 'Thermodynamics',
      icon: 'M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10',
      baseSymbol: 'W',
      units: [
        { name: 'Watt',                    symbol: 'W',      factor: 1 },
        { name: 'Kilowatt',                symbol: 'kW',     factor: 1e3 },
        { name: 'Megawatt',                symbol: 'MW',     factor: 1e6 },
        { name: 'Gigawatt',                symbol: 'GW',     factor: 1e9 },
        { name: 'Milliwatt',               symbol: 'mW',     factor: 0.001 },
        { name: 'Horsepower (mech.)',      symbol: 'hp',     factor: 745.700 },
        { name: 'Horsepower (metric)',     symbol: 'hk',     factor: 735.499 },
        { name: 'BTU/hour',                symbol: 'BTU/h',  factor: 0.293071 },
        { name: 'BTU/minute',              symbol: 'BTU/min',factor: 17.5843 },
        { name: 'BTU/second',              symbol: 'BTU/s',  factor: 1055.06 },
        { name: 'kcal/hour',              symbol: 'kcal/h', factor: 1.163 },
        { name: 'kgf·m/s',               symbol: 'kgf·m/s',factor: 9.80665 },
        { name: 'Ton of refrigeration',   symbol: 'TR',     factor: 3516.85 },
        { name: 'ft·lbf/s',              symbol: 'ft·lbf/s',factor: 1.35582 },
      ]
    },
    {
      id: 'specific_heat', name: 'Specific Heat', group: 'Thermodynamics',
      icon: 'M12 22a8 8 0 0 1-8-8c0-4.314 6-12 8-12s8 7.686 8 12a8 8 0 0 1-8 8z',
      baseSymbol: 'J/(kg·K)',
      units: [
        { name: 'J/(kg·K)',          symbol: 'J/(kg·K)',        factor: 1 },
        { name: 'kJ/(kg·K)',         symbol: 'kJ/(kg·K)',       factor: 1000 },
        { name: 'J/(kg·°C)',         symbol: 'J/(kg·°C)',       factor: 1 },
        { name: 'BTU/(lb·°F)',       symbol: 'BTU/(lb·°F)',    factor: 4186.8 },
        { name: 'BTU/(lb·°R)',       symbol: 'BTU/(lb·°R)',    factor: 4186.8 },
        { name: 'kcal/(kg·°C)',      symbol: 'kcal/(kg·°C)',   factor: 4186.8 },
        { name: 'cal/(g·°C)',        symbol: 'cal/(g·°C)',     factor: 4186.8 },
        { name: 'ft·lbf/(slug·°R)', symbol: 'ft·lbf/(slug·°R)',factor: 0.167226 },
      ]
    },
    {
      id: 'temperature', name: 'Temperature', group: 'Thermodynamics',
      icon: 'M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z',
      isTemperature: true,
      baseSymbol: '°C',
      units: [
        { name: 'Celsius',    symbol: '°C',  toBase: v => v,                    fromBase: v => v },
        { name: 'Fahrenheit', symbol: '°F',  toBase: v => (v - 32) * 5/9,      fromBase: v => v * 9/5 + 32 },
        { name: 'Kelvin',     symbol: 'K',   toBase: v => v - 273.15,           fromBase: v => v + 273.15 },
        { name: 'Rankine',    symbol: '°R',  toBase: v => (v - 491.67) * 5/9,  fromBase: v => (v + 273.15) * 9/5 },
      ]
    },
    {
      id: 'thermal_cond', name: 'Thermal Conductivity', group: 'Thermodynamics',
      icon: 'M21 12a9 9 0 1 1-9-9c2.52 0 4.85.94 6.6 2.49M21 3v6h-6',
      baseSymbol: 'W/(m·K)',
      units: [
        { name: 'W/(m·K)',               symbol: 'W/(m·K)',             factor: 1 },
        { name: 'W/(m·°C)',              symbol: 'W/(m·°C)',            factor: 1 },
        { name: 'kW/(m·K)',              symbol: 'kW/(m·K)',            factor: 1000 },
        { name: 'BTU/(h·ft·°F)',         symbol: 'BTU/(h·ft·°F)',      factor: 1.73073 },
        { name: 'BTU·in/(h·ft²·°F)',    symbol: 'BTU·in/(h·ft²·°F)',  factor: 0.144228 },
        { name: 'kcal/(h·m·°C)',        symbol: 'kcal/(h·m·°C)',      factor: 1.163 },
        { name: 'cal/(s·cm·°C)',        symbol: 'cal/(s·cm·°C)',      factor: 418.68 },
      ]
    },

    // -------- FLUIDS --------
    {
      id: 'massflow', name: 'Mass Flow Rate', group: 'Fluids',
      icon: 'M22 12h-4l-3 9L9 3l-3 9H2',
      baseSymbol: 'kg/s',
      units: [
        { name: 'kg/s',       symbol: 'kg/s',    factor: 1 },
        { name: 'kg/min',     symbol: 'kg/min',  factor: 1/60 },
        { name: 'kg/h',       symbol: 'kg/h',    factor: 1/3600 },
        { name: 'g/s',        symbol: 'g/s',     factor: 0.001 },
        { name: 'g/min',      symbol: 'g/min',   factor: 1/60000 },
        { name: 'lb/s',       symbol: 'lb/s',    factor: 0.453592 },
        { name: 'lb/min',     symbol: 'lb/min',  factor: 0.00755987 },
        { name: 'lb/h',       symbol: 'lb/h',    factor: 0.000125998 },
        { name: 'ton/h',      symbol: 'ton/h',   factor: 0.277778 },
        { name: 'slug/s',     symbol: 'slug/s',  factor: 14.5939 },
      ]
    },
    {
      id: 'viscosity_dyn', name: 'Dynamic Viscosity', group: 'Fluids',
      icon: 'M12 2v20M8 6l4-4 4 4M8 18l4 4 4-4',
      baseSymbol: 'Pa·s',
      units: [
        { name: 'Pascal-second',      symbol: 'Pa·s',     factor: 1 },
        { name: 'Millipascal-second', symbol: 'mPa·s',    factor: 0.001 },
        { name: 'Poise',              symbol: 'P',        factor: 0.1 },
        { name: 'Centipoise',         symbol: 'cP',       factor: 0.001 },
        { name: 'Millipoise',         symbol: 'mP',       factor: 0.0001 },
        { name: 'lbf·s/ft²',         symbol: 'lbf·s/ft²',factor: 47.8803 },
        { name: 'lb/(ft·s)',          symbol: 'lb/(ft·s)', factor: 1.48816 },
        { name: 'lb/(ft·h)',          symbol: 'lb/(ft·h)', factor: 4.13378e-4 },
        { name: 'slug/(ft·s)',        symbol: 'slug/(ft·s)',factor: 47.8803 },
        { name: 'kg/(m·h)',           symbol: 'kg/(m·h)',  factor: 2.77778e-4 },
      ]
    },
    {
      id: 'viscosity_kin', name: 'Kinematic Viscosity', group: 'Fluids',
      icon: 'M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4',
      baseSymbol: 'm²/s',
      units: [
        { name: 'Square metre/second', symbol: 'm²/s',   factor: 1 },
        { name: 'Square cm/second',    symbol: 'cm²/s',  factor: 1e-4 },
        { name: 'Square mm/second',    symbol: 'mm²/s',  factor: 1e-6 },
        { name: 'Stokes',              symbol: 'St',     factor: 1e-4 },
        { name: 'Centistokes',         symbol: 'cSt',    factor: 1e-6 },
        { name: 'Millistokes',         symbol: 'mSt',    factor: 1e-7 },
        { name: 'Square foot/second',  symbol: 'ft²/s',  factor: 9.2903e-2 },
        { name: 'Square foot/hour',    symbol: 'ft²/h',  factor: 2.5806e-5 },
        { name: 'Square inch/second',  symbol: 'in²/s',  factor: 6.4516e-4 },
      ]
    },

    // -------- ELECTRICAL --------
    {
      id: 'pressure', name: 'Pressure', group: 'Mechanics',
      icon: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8zm-1-5h2v2h-2zm0-8h2v6h-2z',
      baseSymbol: 'Pa',
      units: [
        { name: 'Pascal',             symbol: 'Pa',      factor: 1 },
        { name: 'Kilopascal',         symbol: 'kPa',     factor: 1e3 },
        { name: 'Megapascal',         symbol: 'MPa',     factor: 1e6 },
        { name: 'Bar',                symbol: 'bar',     factor: 1e5 },
        { name: 'Millibar',           symbol: 'mbar',    factor: 100 },
        { name: 'PSI',                symbol: 'psi',     factor: 6894.757 },
        { name: 'Atmosphere (atm)',   symbol: 'atm',     factor: 101325 },
        { name: 'Torr (mmHg)',        symbol: 'Torr',    factor: 133.3224 },
        { name: 'kgf/cm²',           symbol: 'kgf/cm²', factor: 98066.5 },
        { name: 'inHg',              symbol: 'inHg',    factor: 3386.39 },
        { name: 'inH₂O',             symbol: 'inH₂O',   factor: 249.089 },
        { name: 'mmH₂O',             symbol: 'mmH₂O',   factor: 9.80665 },
        { name: 'ftH₂O',             symbol: 'ftH₂O',   factor: 2988.98 },
      ]
    },
    {
      id: 'current', name: 'Current', group: 'Electrical',
      icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
      baseSymbol: 'A',
      units: [
        { name: 'Ampere',       symbol: 'A',   factor: 1 },
        { name: 'Milliampere',  symbol: 'mA',  factor: 0.001 },
        { name: 'Microampere',  symbol: 'µA',  factor: 1e-6 },
        { name: 'Kiloampere',   symbol: 'kA',  factor: 1000 },
        { name: 'Megaampere',   symbol: 'MA',  factor: 1e6 },
        { name: 'Abampere',     symbol: 'abA', factor: 10 },
        { name: 'Statampere',   symbol: 'statA',factor: 3.336e-10 },
      ]
    },
    {
      id: 'voltage', name: 'Voltage', group: 'Electrical',
      icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
      baseSymbol: 'V',
      units: [
        { name: 'Volt',         symbol: 'V',    factor: 1 },
        { name: 'Millivolt',    symbol: 'mV',   factor: 0.001 },
        { name: 'Microvolt',    symbol: 'µV',   factor: 1e-6 },
        { name: 'Kilovolt',     symbol: 'kV',   factor: 1000 },
        { name: 'Megavolt',     symbol: 'MV',   factor: 1e6 },
        { name: 'Statvolt',     symbol: 'statV',factor: 299.792 },
        { name: 'Abvolt',       symbol: 'abV',  factor: 1e-8 },
      ]
    },
  ];

  // Build a lookup map
  const CAT_MAP = {};
  CATEGORIES.forEach(c => CAT_MAP[c.id] = c);

  // ============================================================
  //  State
  // ============================================================
  let activeCatId = CATEGORIES[0].id;

  // ============================================================
  //  DOM refs
  // ============================================================
  const tabsEl        = document.getElementById('category-tabs');
  const searchInput   = document.getElementById('cat-search');
  const searchWrapper = document.getElementById('search-wrapper');
  const searchClear   = document.getElementById('search-clear');
  const noResults     = document.getElementById('no-results');
  const noResultsTerm = document.getElementById('no-results-term');
  const fromSel       = document.getElementById('from-unit');
  const toSel         = document.getElementById('to-unit');
  const fromInput     = document.getElementById('from-value');
  const toInput       = document.getElementById('to-value');
  const fromName      = document.getElementById('from-unit-name');
  const toName        = document.getElementById('to-unit-name');
  const swapBtn       = document.getElementById('swap-btn');
  const copyBtn       = document.getElementById('copy-result-btn');
  const refBody       = document.getElementById('ref-table-body');
  const toast         = document.getElementById('toast');

  // ============================================================
  //  Build Tabs (grouped)
  // ============================================================
  let tabEls = {}; // id -> button el

  function buildTabs() {
    tabsEl.innerHTML = '';
    GROUPS.forEach(group => {
      const label = document.createElement('div');
      label.className = 'group-label';
      label.textContent = group.label;
      tabsEl.appendChild(label);

      const row = document.createElement('div');
      row.className = 'category-tabs';
      tabsEl.appendChild(row);

      group.ids.forEach(id => {
        const cat = CAT_MAP[id];
        if (!cat) return;
        const btn = document.createElement('button');
        btn.className = 'cat-btn' + (id === activeCatId ? ' active' : '');
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-selected', id === activeCatId ? 'true' : 'false');
        btn.setAttribute('aria-label', cat.name);
        btn.dataset.catId = id;
        btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="${cat.icon}"></path></svg>${cat.name}`;
        btn.addEventListener('click', () => selectCategory(id));
        row.appendChild(btn);
        tabEls[id] = btn;
      });
    });
  }

  function selectCategory(id) {
    activeCatId = id;
    Object.entries(tabEls).forEach(([tid, btn]) => {
      btn.classList.toggle('active', tid === id);
      btn.setAttribute('aria-selected', tid === id ? 'true' : 'false');
    });
    populateSelects();
    fromInput.value = 1;
    convert();
    buildRefTable();
  }

  // ============================================================
  //  Search / Filter
  // ============================================================
  function filterTabs(query) {
    const q = query.trim().toLowerCase();
    const groupLabels = tabsEl.querySelectorAll('.group-label');
    const rows = tabsEl.querySelectorAll('.category-tabs');
    let anyVisible = false;

    // Clear badges
    Object.values(tabEls).forEach(btn => {
      const badge = btn.querySelector('.match-badge');
      if (badge) badge.remove();
    });

    GROUPS.forEach((group, gi) => {
      let groupHasVisible = false;
      group.ids.forEach(id => {
        const cat = CAT_MAP[id];
        const btn = tabEls[id];
        if (!cat || !btn) return;

        if (!q) {
          btn.classList.remove('hidden-cat');
          groupHasVisible = true;
          anyVisible = true;
          return;
        }

        // Match category name
        const nameMatch = cat.name.toLowerCase().includes(q);
        // Match unit names
        const unitMatches = cat.units.filter(u =>
          u.name.toLowerCase().includes(q) || u.symbol.toLowerCase().includes(q)
        );

        if (nameMatch || unitMatches.length > 0) {
          btn.classList.remove('hidden-cat');
          groupHasVisible = true;
          anyVisible = true;
          if (!nameMatch && unitMatches.length > 0) {
            const badge = document.createElement('span');
            badge.className = 'match-badge';
            badge.textContent = unitMatches.length;
            btn.appendChild(badge);
          }
        } else {
          btn.classList.add('hidden-cat');
        }
      });

      if (groupLabels[gi]) groupLabels[gi].style.display = groupHasVisible ? '' : 'none';
      if (rows[gi]) rows[gi].style.display = groupHasVisible ? '' : 'none';
    });

    noResults.classList.toggle('show', !anyVisible);
    noResultsTerm.textContent = query;
  }

  searchInput.addEventListener('input', () => {
    const q = searchInput.value;
    filterTabs(q);
    searchWrapper.classList.toggle('search-active', q.length > 0);
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    filterTabs('');
    searchWrapper.classList.remove('search-active');
    searchInput.focus();
  });

  // "/" shortcut to focus search
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== searchInput &&
        document.activeElement.tagName !== 'INPUT' &&
        document.activeElement.tagName !== 'SELECT') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
    if (e.key === 'Escape' && document.activeElement === searchInput) {
      searchInput.blur();
    }
  });

  // ============================================================
  //  Populate unit dropdowns
  // ============================================================
  function populateSelects() {
    const cat = CAT_MAP[activeCatId];
    [fromSel, toSel].forEach((sel, idx) => {
      sel.innerHTML = '';
      cat.units.forEach((u, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `${u.name} (${u.symbol})`;
        sel.appendChild(opt);
      });
      sel.value = idx === 0 ? 0 : (cat.units.length > 1 ? 1 : 0);
    });
    updateUnitNames();
  }

  function updateUnitNames() {
    const cat = CAT_MAP[activeCatId];
    const fu = cat.units[parseInt(fromSel.value)];
    const tu = cat.units[parseInt(toSel.value)];
    fromName.textContent = fu ? fu.name : '';
    toName.textContent   = tu ? tu.name : '';
  }

  // ============================================================
  //  Conversion Engine
  // ============================================================
  function convertValue(value, fromUnit, toUnit, cat) {
    if (typeof UnitConvert !== "undefined") {
      return UnitConvert.convertValue(value, fromUnit, toUnit, cat);
    }
    if (cat.isTemperature) {
      return toUnit.fromBase(fromUnit.toBase(value));
    }
    return value * (fromUnit.factor / toUnit.factor);
  }

  function convert() {
    const cat = CAT_MAP[activeCatId];
    const fu = cat.units[parseInt(fromSel.value)];
    const tu = cat.units[parseInt(toSel.value)];
    if (!fu || !tu) return;
    const v = parseFloat(fromInput.value);
    if (isNaN(v)) { toInput.value = ''; return; }
    toInput.value = formatResult(convertValue(v, fu, tu, cat));
  }

  function formatResult(v) {
    if (isNaN(v) || !isFinite(v)) return '—';
    if (v === 0) return '0';
    const abs = Math.abs(v);
    if (abs >= 1e-3 && abs < 1e8) return parseFloat(v.toPrecision(8)).toString();
    return v.toExponential(6);
  }

  // ============================================================
  //  Reference Table
  // ============================================================
  function buildRefTable() {
    const cat = CAT_MAP[activeCatId];
    refBody.innerHTML = '';
    cat.units.forEach(u => {
      const tr = document.createElement('tr');
      let equiv;
      if (cat.isTemperature) {
        equiv = '— (offset scale)';
      } else {
        equiv = `1 ${u.symbol} = ${formatResult(u.factor)} ${cat.baseSymbol}`;
      }
      tr.innerHTML = `<td>${u.name}</td><td>${u.symbol}</td><td>${equiv}</td>`;
      refBody.appendChild(tr);
    });
  }

  // ============================================================
  //  Event Wiring
  // ============================================================
  fromInput.addEventListener('input', convert);
  fromSel.addEventListener('change', () => { updateUnitNames(); convert(); });
  toSel.addEventListener('change', () => { updateUnitNames(); convert(); });

  swapBtn.addEventListener('click', () => {
    const fromIdx = fromSel.value;
    const resultVal = toInput.value;
    fromSel.value = toSel.value;
    toSel.value = fromIdx;
    if (resultVal && resultVal !== '—') fromInput.value = resultVal;
    updateUnitNames();
    convert();
  });

  copyBtn.addEventListener('click', () => {
    const val = toInput.value;
    if (!val || val === '—') return;
    const cat = CAT_MAP[activeCatId];
    const unit = cat.units[parseInt(toSel.value)];
    const text = `${val} ${unit ? unit.symbol : ''}`.trim();
    navigator.clipboard.writeText(text).then(() => showToast('Copied: ' + text))
      .catch(() => {
        const ta = Object.assign(document.createElement('textarea'), { value: text });
        document.body.appendChild(ta); ta.select(); document.execCommand('copy');
        document.body.removeChild(ta); showToast('Copied: ' + text);
      });
  });

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2800);
  }

  // ============================================================
  //  Init
  // ============================================================
  buildTabs();
  populateSelects();
  convert();
  buildRefTable();
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
