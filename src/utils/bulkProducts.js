import * as XLSX from "xlsx";

export const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);
export const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".m4a", ".aac", ".ogg", ".oga", ".flac", ".aif", ".aiff", ".opus"]);

export const IMAGE_MIME = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".avif": "image/avif",
};

export const AUDIO_MIME = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".ogg": "audio/ogg",
    ".oga": "audio/ogg",
    ".flac": "audio/flac",
    ".aif": "audio/aiff",
    ".aiff": "audio/aiff",
    ".opus": "audio/opus",
};

export const BULK_COLLECTIONS = {
    drop: { collectionName: "productos", catalogKey: "drop", label: "Drops" },
    tienda: { collectionName: "productosTienda", catalogKey: "tienda", label: "Tienda" },
    equipamiento: { collectionName: "equipamiento", catalogKey: "equipamiento", label: "Equipamiento" },
};

const COLECCION_ALIASES = {
    productos: "drop",
    producto: "drop",
    drop: "drop",
    drops: "drop",
    tienda: "tienda",
    productostienda: "tienda",
    "productos tienda": "tienda",
    tiendafisica: "tienda",
    "tienda fisica": "tienda",
    equipamiento: "equipamiento",
    equipos: "equipamiento",
    equipo: "equipamiento",
};

const DEFAULT_COLECCION = "tienda";

const TRACK_FIELDS = {
    titulo: "titulo",
    title: "titulo",
    bpm: "bpm",
    audio: "audio",
    archivo: "audio",
    autor: "autor",
    artist: "autor",
    artista: "autor",
    duracion: "duracion",
    duration: "duracion",
};

export function normalizarClave(valor) {
    return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ");
}

function normalizarRuta(valor) {
    return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\\/g, "/")
        .trim()
        .toLowerCase()
        .replace(/\/+/g, "/")
        .replace(/^\.?\//, "");
}

export function generarId(valor) {
    return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

export function sanitizeFileName(name = "") {
    return String(name)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "-")
        .replace(/\.{2,}/g, ".");
}

export function stripExtension(name = "") {
    return String(name).replace(/\.[a-z0-9]+$/i, "").trim().replace(/\s+/g, " ");
}

export function getExtension(name = "") {
    const match = String(name).match(/\.[a-z0-9]+$/i);
    return match ? match[0].toLowerCase() : "";
}

export function toNumber(valor) {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : 0;
}

export function pickValue(obj, keys, fallback = "") {
    for (const key of keys) {
        const value = obj[key];
        if (value !== undefined && value !== null && String(value).trim() !== "") {
            return value;
        }
    }
    return fallback;
}

export function esUrl(valor) {
    return /^https?:\/\//i.test(String(valor || "").trim());
}

export function getContentType(fileName, kind = "image") {
    const ext = getExtension(fileName);
    if (kind === "audio") return AUDIO_MIME[ext] || "audio/mpeg";
    return IMAGE_MIME[ext] || "image/jpeg";
}

function basename(value) {
    const text = String(value || "");
    const index = Math.max(text.lastIndexOf("/"), text.lastIndexOf("\\"));
    return index >= 0 ? text.slice(index + 1) : text;
}

export function normalizarFila(fila) {
    const normalizada = {};
    for (const [clave, valor] of Object.entries(fila)) {
        normalizada[normalizarClave(clave)] = valor;
    }
    return normalizada;
}

export function encontrarHoja(workbook, aliases) {
    const buscadas = aliases.map(normalizarClave);
    return workbook.SheetNames.find((name) => buscadas.includes(normalizarClave(name)));
}

export function leerFilas(workbook, sheetName) {
    if (!sheetName) return [];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];

    return XLSX.utils
        .sheet_to_json(sheet, { defval: "" })
        .map(normalizarFila)
        .filter((fila) => Object.values(fila).some((valor) => String(valor).trim() !== ""));
}

export function resolverColeccion(fila) {
    const raw = pickValue(
        fila,
        ["coleccion", "collection", "collectionname", "catalogokey", "catalogkey", "tipo"],
        "",
    );
    const alias = COLECCION_ALIASES[normalizarClave(raw)] || DEFAULT_COLECCION;
    return { key: alias, ...BULK_COLLECTIONS[alias] };
}

function normalizarTrack(fila, index) {
    const audio = String(
        pickValue(fila, ["audio", "archivo", "audiofile", "filename", "file", "mp3"], ""),
    ).trim();

    const titulo =
        String(
            pickValue(
                fila,
                ["titulo", "tracktitulo", "titulo_track", "title", "track", "nombre"],
                "",
            ),
        ).trim() || stripExtension(basename(audio));

    const bpmRaw = pickValue(fila, ["bpm", "tempo"], "");
    const bpm = bpmRaw === "" ? null : Number(bpmRaw) || null;

    const duracionRaw = pickValue(fila, ["duracion", "duration", "length"], "");
    const duracion = duracionRaw === "" ? null : Number(duracionRaw) || null;

    const ordenRaw = pickValue(
        fila,
        ["orden", "order", "nro", "numero", "tracknumber", "tracknumero", "posicion"],
        "",
    );
    const orden = ordenRaw === "" ? index + 1 : Number(ordenRaw) || index + 1;

    const autor = String(pickValue(fila, ["autor", "artist", "artista", "artists"], "")).trim();

    return {
        titulo,
        bpm,
        autor,
        audio,
        duracion,
        orden,
        _index: index,
    };
}

function extraerTracksInline(producto) {
    const grupos = new Map();

    const getGrupo = (numero) => {
        const key = String(numero || 1);
        if (!grupos.has(key)) {
            grupos.set(key, { _index: Number(key) });
        }
        return grupos.get(key);
    };

    for (const [clave, valor] of Object.entries(producto)) {
        const texto = String(valor ?? "").trim();
        if (!texto) continue;

        if (clave === "audio" || clave === "archivo") {
            getGrupo(1).audio = texto;
            continue;
        }

        if (clave === "bpm" || clave === "tempo") {
            getGrupo(1).bpm = texto;
            continue;
        }

        const soloAudio = clave.match(/^(?:audio|archivo)_?(\d+)$/);
        if (soloAudio) {
            getGrupo(soloAudio[1]).audio = texto;
            continue;
        }

        const match = clave.match(
            /^(track|pista|audio|archivo)_?(\d+)?_?(titulo|title|bpm|audio|archivo|autor|artist|artista|duracion|duration)$/,
        );
        if (!match) continue;

        const campo = TRACK_FIELDS[match[3]];
        if (!campo) continue;

        getGrupo(match[2])[campo] = texto;
    }

    return [...grupos.values()]
        .map((fila, index) => normalizarTrack(fila, index))
        .filter((track) => track.audio || track.titulo);
}

function dedupeTracks(tracks) {
    const vistos = new Set();
    const resultado = [];

    for (const track of tracks) {
        const key = `${normalizarClave(track.audio)}|${normalizarClave(track.titulo)}|${track.orden}`;
        if (vistos.has(key)) continue;
        vistos.add(key);
        resultado.push(track);
    }

    return resultado.sort((a, b) => a.orden - b.orden || a._index - b._index);
}

function agruparTracks(rows) {
    const porId = new Map();
    const porTitulo = new Map();

    const agregar = (mapa, key, track) => {
        if (!key) return;
        if (!mapa.has(key)) mapa.set(key, []);
        mapa.get(key).push(track);
    };

    rows.forEach((fila, index) => {
        const track = normalizarTrack(fila, index);
        if (!track.audio && !track.titulo) return;

        const productoId = String(
            pickValue(fila, ["productoid", "producto_id", "producto id", "idproducto", "id producto"], ""),
        ).trim();
        const productoTitulo = String(
            pickValue(
                fila,
                [
                    "producto",
                    "productotitulo",
                    "producto_titulo",
                    "producto titulo",
                    "titulo_producto",
                    "titulo producto",
                    "disco",
                    "album",
                ],
                "",
            ),
        ).trim();

        if (productoId) {
            agregar(porId, generarId(productoId), track);
        }

        if (productoTitulo) {
            agregar(porId, generarId(productoTitulo), track);
            agregar(porTitulo, normalizarClave(productoTitulo), track);
        }
    });

    return { porId, porTitulo };
}

export function parseBulkWorkbook(workbook) {
    const errors = [];
    const warnings = [];

    const hojaProductos =
        encontrarHoja(workbook, [
            "productos",
            "carga",
            "productos tienda",
            "productostienda",
            "carga productos",
            "productos fran",
        ]) || workbook.SheetNames[0];

    const hojaTracks = encontrarHoja(workbook, [
        "tracks",
        "pistas",
        "tracklist",
        "audios",
        "temas",
        "canciones",
    ]);

    if (!hojaProductos) {
        return {
            products: [],
            errors: ["El Excel no tiene ninguna hoja de productos."],
            warnings,
            meta: { hojaProductos: "", hojaTracks: "", filasProductos: 0, filasTracks: 0 },
        };
    }

    const filasProductos = leerFilas(workbook, hojaProductos);
    const filasTracks = leerFilas(workbook, hojaTracks);
    const { porId, porTitulo } = agruparTracks(filasTracks);

    const products = [];
    const idsUsados = new Set();

    filasProductos.forEach((fila, index) => {
        const filaNumero = index + 2;
        const titulo = String(pickValue(fila, ["titulo", "title", "nombre"], "")).trim();
        const idRaw = String(pickValue(fila, ["id", "productoid", "docid", "slug"], "")).trim();

        if (!titulo && !idRaw) return;

        if (!titulo) {
            errors.push(`Fila ${filaNumero}: falta el título del producto.`);
            return;
        }

        const id = generarId(idRaw || titulo);
        if (!id) {
            errors.push(`Fila ${filaNumero}: no se pudo generar un ID válido.`);
            return;
        }

        if (idsUsados.has(id)) {
            errors.push(`Fila ${filaNumero}: ID duplicado "${id}".`);
            return;
        }
        idsUsados.add(id);

        const tracks = dedupeTracks([
            ...(porId.get(id) || []),
            ...(porTitulo.get(normalizarClave(titulo)) || []),
            ...extraerTracksInline(fila),
        ]);

        products.push({
            fila: filaNumero,
            id,
            titulo,
            row: fila,
            coleccion: resolverColeccion(fila),
            tracks,
        });
    });

    const usedIndexes = new Set(
        products.flatMap((product) => product.tracks.map((track) => track._index)),
    );

    filasTracks.forEach((fila, index) => {
        const track = normalizarTrack(fila, index);
        if (!track.audio && !track.titulo) return;
        if (!usedIndexes.has(track._index)) {
            warnings.push(
                `Fila de tracks ${index + 2}: no coincide con ningún producto (${track.titulo || track.audio}).`,
            );
        }
    });

    if (!products.length) {
        errors.push("No se encontraron productos válidos en el Excel.");
    }

    return {
        products,
        errors,
        warnings,
        meta: {
            hojaProductos,
            hojaTracks: hojaTracks || "(sin hoja tracks)",
            filasProductos: filasProductos.length,
            filasTracks: filasTracks.length,
        },
    };
}

export function buildFileIndex(files) {
    const index = new Map();

    const add = (key, file) => {
        const normalizado = normalizarRuta(key);
        if (!normalizado) return;
        const list = index.get(normalizado) || [];
        if (!list.includes(file)) list.push(file);
        index.set(normalizado, list);
    };

    for (const file of files) {
        const relative = normalizarRuta(file.webkitRelativePath || file.name);
        add(relative, file);
        add(file.name, file);

        const parts = relative.split("/");
        if (parts.length > 1) {
            add(parts.slice(1).join("/"), file);
        }
    }

    return index;
}

export function findFile(index, name) {
    const key = normalizarRuta(name);
    const candidates = index.get(key) || [];

    if (candidates.length === 1) {
        return { file: candidates[0], ambiguous: false, candidates };
    }

    if (candidates.length > 1) {
        return { file: null, ambiguous: true, candidates };
    }

    return { file: null, ambiguous: false, candidates: [] };
}

export function buildBulkPlan(products, imageIndex, audioIndex, options = {}) {
    const errors = [];
    const warnings = [];
    const plan = [];

    for (const product of products) {
        const imageName = String(product.row.imagen || "").trim();
        const imageIsUrl = esUrl(imageName);
        let imageFile = null;

        if (!imageName) {
            if (!options.allowMissingImages) {
                errors.push(`Fila ${product.fila} | ${product.titulo} | imagen vacía`);
            }
        } else if (!imageIsUrl) {
            const found = findFile(imageIndex, imageName);

            if (found.ambiguous) {
                errors.push(
                    `Fila ${product.fila} | ${product.titulo} | imagen ambigua (${found.candidates.length} archivos): ${imageName}`,
                );
            } else if (!found.file) {
                errors.push(`Fila ${product.fila} | ${product.titulo} | imagen no encontrada: ${imageName}`);
            } else {
                const ext = getExtension(found.file.name);
                if (!IMAGE_EXTENSIONS.has(ext)) {
                    errors.push(
                        `Fila ${product.fila} | ${product.titulo} | imagen con extensión no soportada: ${imageName}`,
                    );
                } else {
                    imageFile = found.file;
                }
            }
        }

        const tracks = [];

        product.tracks.forEach((track, index) => {
            const audioName = String(track.audio || "").trim();
            const etiqueta = `Fila ${product.fila} | ${product.titulo} | track ${index + 1}`;

            if (!audioName) {
                if (!options.allowMissingAudio) {
                    errors.push(`${etiqueta} | sin archivo de audio`);
                }
                return;
            }

            if (esUrl(audioName)) {
                errors.push(`${etiqueta} | audio remoto no soportado: ${audioName}`);
                return;
            }

            const found = findFile(audioIndex, audioName);

            if (found.ambiguous) {
                errors.push(
                    `${etiqueta} | audio ambiguo (${found.candidates.length} archivos): ${audioName}`,
                );
            } else if (!found.file) {
                errors.push(`${etiqueta} | audio no encontrado: ${audioName}`);
            } else {
                const ext = getExtension(found.file.name);
                if (!AUDIO_EXTENSIONS.has(ext)) {
                    errors.push(`${etiqueta} | audio con extensión no soportada: ${audioName}`);
                } else {
                    tracks.push({ ...track, audioFile: found.file });
                }
            }
        });

        plan.push({ product, imageFile, imageIsUrl, tracks });
    }

    const stats = {
        productos: plan.length,
        tracks: plan.reduce((total, item) => total + item.tracks.length, 0),
        imagenes: plan.filter((item) => item.imageFile).length,
        imagenesUrl: plan.filter((item) => item.imageIsUrl).length,
        audios: plan.reduce(
            (total, item) => total + item.tracks.filter((track) => track.audioFile).length,
            0,
        ),
        errores: errors.length,
        advertencias: warnings.length,
    };

    return { plan, errors, warnings, stats };
}

export function buildProductDocument(planItem, imageUrl, trackList) {
    const row = planItem.product.row;

    const data = {
        titulo: planItem.product.titulo,
        precio: toNumber(pickValue(row, ["precio", "price"])),
        cantidad: toNumber(pickValue(row, ["cantidad", "stock", "quantity"])),
        reservados: toNumber(pickValue(row, ["reservados", "reserved"])),
        descripcion: String(pickValue(row, ["descripcion", "description"], "")),
        autor: String(pickValue(row, ["autor", "artist", "artista", "artists"], "")),
        categoria: String(pickValue(row, ["categoria", "category"], "new in")) || "new in",
        imagen: imageUrl,
        sello: String(pickValue(row, ["sello", "label"], "")),
        estilo: String(pickValue(row, ["estilo", "style"], "")),
        genero: String(pickValue(row, ["genero", "genre"], "")),
        escucha: String(pickValue(row, ["escucha", "escuchar"], "")),
        catalogo: String(pickValue(row, ["catalogo", "catalog", "catalognumber", "catno"], "")),
        trackList,
        catalogKey: planItem.product.coleccion.catalogKey,
        collectionName: planItem.product.coleccion.collectionName,
    };

    const soundcloud = String(pickValue(row, ["soundcloud"], "")).trim();
    if (soundcloud) data.soundcloud = soundcloud;

    const precioOriginal = pickValue(row, ["preciooriginal", "precio original"], "");
    if (precioOriginal !== "") data.precioOriginal = toNumber(precioOriginal);

    const precioFinal = pickValue(row, ["preciofinal", "precio final"], "");
    if (precioFinal !== "") data.precioFinal = toNumber(precioFinal);

    return data;
}
