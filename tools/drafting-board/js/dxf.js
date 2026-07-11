// ==========================================================================
// Explicit 2D CAD DXF Database and File Pipeline (Phase 1)
// Handles R2007 (AC1021) / R12 compatibility parsing and exporting
// ==========================================================================

class DxfDatabase {
  constructor() {
    this.layers = {};  // name -> { color, linetype, visible, frozen }
    this.blocks = {};  // name -> { basePoint: {x,y}, entities: [] }
    this.entities = []; // World Coordinate Space (WCS) entities
    this.clear();
  }

  clear() {
    this.layers = {
      "0": { color: 7, linetype: "CONTINUOUS", visible: true, frozen: false },
      "Defpoints": { color: 7, linetype: "CONTINUOUS", visible: false, frozen: false }
    };
    this.blocks = {};
    this.entities = [];
  }

  addLayer(name, color = 7, linetype = "CONTINUOUS") {
    if (!this.layers[name]) {
      this.layers[name] = { color, linetype, visible: true, frozen: false };
    }
  }

  // Parse ASCII DXF format into memory-optimized tree database
  parse(dxfString) {
    this.clear();
    
    // Split into line array and clean whitespace
    const lines = dxfString.split(/\r?\n/).map(line => line.trim()).filter(line => line !== "");
    const records = [];
    for (let i = 0; i < lines.length - 1; i += 2) {
      const code = parseInt(lines[i]);
      const value = lines[i + 1];
      if (!isNaN(code)) {
        records.push({ code, value });
      }
    }

    let idx = 0;
    const next = () => records[idx++];
    const peek = () => records[idx];

    while (idx < records.length) {
      const record = next();
      if (record.code === 0 && record.value === "SECTION") {
        const nameRecord = next();
        if (nameRecord.code === 2) {
          const sectName = nameRecord.value;
          if (sectName === "TABLES") {
            this.parseTablesSection(next, peek, records);
          } else if (sectName === "BLOCKS") {
            this.parseBlocksSection(next, peek, records);
          } else if (sectName === "ENTITIES") {
            this.parseEntitiesSection(next, peek, records, this.entities);
          }
        }
      }
    }
  }

  parseTablesSection(next, peek, records) {
    while (peek() && !(peek().code === 0 && peek().value === "ENDSEC")) {
      const r = next();
      if (r.code === 0 && r.value === "TABLE") {
        const nameRec = next();
        if (nameRec.code === 2 && nameRec.value === "LAYER") {
          while (peek() && !(peek().code === 0 && peek().value === "ENDTAB")) {
            const subR = next();
            if (subR.code === 0 && subR.value === "LAYER") {
              let layerName = "";
              let color = 7;
              let linetype = "CONTINUOUS";
              
              while (peek() && peek().code !== 0) {
                const prop = next();
                if (prop.code === 2) layerName = prop.value;
                else if (prop.code === 62) color = parseInt(prop.value);
                else if (prop.code === 6) linetype = prop.value;
              }
              
              if (layerName) {
                this.layers[layerName] = {
                  color: Math.abs(color),
                  linetype: linetype,
                  visible: color >= 0,
                  frozen: false
                };
              }
            }
          }
        }
      }
    }
  }

  parseBlocksSection(next, peek, records) {
    while (peek() && !(peek().code === 0 && peek().value === "ENDSEC")) {
      const r = next();
      if (r.code === 0 && r.value === "BLOCK") {
        let blockName = "";
        let basePoint = { x: 0, y: 0 };
        
        while (peek() && peek().code !== 0) {
          const prop = next();
          if (prop.code === 2) blockName = prop.value;
          else if (prop.code === 10) basePoint.x = parseFloat(prop.value);
          else if (prop.code === 20) basePoint.y = parseFloat(prop.value);
        }

        const blockEntities = [];
        while (peek() && !(peek().code === 0 && peek().value === "ENDBLK")) {
          this.parseSingleEntity(next, peek, records, blockEntities);
        }
        
        if (blockName) {
          this.blocks[blockName] = {
            basePoint: basePoint,
            entities: blockEntities
          };
        }
      }
    }
  }

  parseEntitiesSection(next, peek, records, list) {
    while (peek() && !(peek().code === 0 && peek().value === "ENDSEC")) {
      this.parseSingleEntity(next, peek, records, list);
    }
  }

  parseSingleEntity(next, peek, records, list) {
    const r = peek();
    if (r && r.code === 0) {
      const type = r.value;
      next(); // consume type tag
      
      let entity = { type: type, layer: "0" };
      
      while (peek() && peek().code !== 0) {
        const prop = next();
        if (prop.code === 8) entity.layer = prop.value;
        else if (prop.code === 62) entity.color = parseInt(prop.value);
        
        if (type === "LINE") {
          if (prop.code === 10) entity.x1 = parseFloat(prop.value);
          else if (prop.code === 20) entity.y1 = parseFloat(prop.value);
          else if (prop.code === 11) entity.x2 = parseFloat(prop.value);
          else if (prop.code === 21) entity.y2 = parseFloat(prop.value);
        }
        else if (type === "CIRCLE") {
          if (prop.code === 10) entity.cx = parseFloat(prop.value);
          else if (prop.code === 20) entity.cy = parseFloat(prop.value);
          else if (prop.code === 40) entity.r = parseFloat(prop.value);
        }
        else if (type === "ARC") {
          if (prop.code === 10) entity.cx = parseFloat(prop.value);
          else if (prop.code === 20) entity.cy = parseFloat(prop.value);
          else if (prop.code === 40) entity.r = parseFloat(prop.value);
          else if (prop.code === 50) entity.startAngle = parseFloat(prop.value);
          else if (prop.code === 51) entity.endAngle = parseFloat(prop.value);
        }
        else if (type === "LWPOLYLINE") {
          if (prop.code === 90) entity.numVertices = parseInt(prop.value);
          else if (prop.code === 70) entity.closed = parseInt(prop.value) === 1;
          else if (prop.code === 10) {
            if (!entity.vertices) entity.vertices = [];
            entity.vertices.push({ x: parseFloat(prop.value), y: 0 });
          }
          else if (prop.code === 20) {
            if (entity.vertices && entity.vertices.length > 0) {
              entity.vertices[entity.vertices.length - 1].y = parseFloat(prop.value);
            }
          }
        }
        else if (type === "TEXT") {
          if (prop.code === 10) entity.x = parseFloat(prop.value);
          else if (prop.code === 20) entity.y = parseFloat(prop.value);
          else if (prop.code === 40) entity.height = parseFloat(prop.value);
          else if (prop.code === 1) entity.text = prop.value;
          else if (prop.code === 50) entity.rotation = parseFloat(prop.value);
        }
        else if (type === "INSERT") {
          if (prop.code === 2) entity.blockName = prop.value;
          else if (prop.code === 10) entity.x = parseFloat(prop.value);
          else if (prop.code === 20) entity.y = parseFloat(prop.value);
          else if (prop.code === 41) entity.scaleX = parseFloat(prop.value);
          else if (prop.code === 42) entity.scaleY = parseFloat(prop.value);
          else if (prop.code === 50) entity.rotation = parseFloat(prop.value);
        }
      }
      list.push(entity);
    } else {
      next();
    }
  }

  // Export back to R2007/R12 ASCII DXF file format
  export() {
    let dxf = "";
    const write = (code, val) => {
      dxf += `  ${code}\n${val}\n`;
    };

    // 1. HEADER SECTION
    write(0, "SECTION");
    write(2, "HEADER");
    write(0, "ENDSEC");

    // 2. TABLES SECTION
    write(0, "SECTION");
    write(2, "TABLES");
    
    // Layer Table
    write(0, "TABLE");
    write(2, "LAYER");
    write(70, Object.keys(this.layers).length);
    for (const [name, layer] of Object.entries(this.layers)) {
      write(0, "LAYER");
      write(2, name);
      write(70, 0);
      write(62, layer.visible ? layer.color : -layer.color);
      write(6, layer.linetype);
    }
    write(0, "ENDTAB");
    write(0, "ENDSEC");

    // 3. BLOCKS SECTION
    write(0, "SECTION");
    write(2, "BLOCKS");
    for (const [name, block] of Object.entries(this.blocks)) {
      write(0, "BLOCK");
      write(2, name);
      write(8, "0");
      write(10, block.basePoint.x);
      write(20, block.basePoint.y);
      write(30, 0.0);
      write(70, 0);

      block.entities.forEach(ent => writeEntity(ent));

      write(0, "ENDBLK");
      write(8, "0");
    }
    write(0, "ENDSEC");

    // 4. ENTITIES SECTION
    write(0, "SECTION");
    write(2, "ENTITIES");

    const writeEntity = (ent) => {
      write(0, ent.type);
      write(8, ent.layer || "0");
      if (ent.color !== undefined) {
        write(62, ent.color);
      }

      if (ent.type === "LINE") {
        write(10, ent.x1);
        write(20, ent.y1);
        write(30, 0.0);
        write(11, ent.x2);
        write(21, ent.y2);
        write(31, 0.0);
      }
      else if (ent.type === "CIRCLE") {
        write(10, ent.cx);
        write(20, ent.cy);
        write(30, 0.0);
        write(40, ent.r);
      }
      else if (ent.type === "ARC") {
        write(10, ent.cx);
        write(20, ent.cy);
        write(30, 0.0);
        write(40, ent.r);
        write(50, ent.startAngle);
        write(51, ent.endAngle);
      }
      else if (ent.type === "LWPOLYLINE") {
        write(90, ent.vertices.length);
        write(70, ent.closed ? 1 : 0);
        ent.vertices.forEach(v => {
          write(10, v.x);
          write(20, v.y);
        });
      }
      else if (ent.type === "TEXT") {
        write(10, ent.x);
        write(20, ent.y);
        write(30, 0.0);
        write(40, ent.height);
        write(1, ent.text);
        if (ent.rotation !== undefined) write(50, ent.rotation);
      }
      else if (ent.type === "INSERT") {
        write(2, ent.blockName);
        write(10, ent.x);
        write(20, ent.y);
        write(30, 0.0);
        if (ent.scaleX !== undefined) write(41, ent.scaleX);
        if (ent.scaleY !== undefined) write(42, ent.scaleY);
        if (ent.rotation !== undefined) write(50, ent.rotation);
      }
    };

    this.entities.forEach(ent => writeEntity(ent));

    write(0, "ENDSEC");
    write(0, "EOF");

    return dxf;
  }
}

// Export for browser and Node.js testing env
if (typeof window !== "undefined") {
  window.DxfDatabase = DxfDatabase;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { DxfDatabase };
}
