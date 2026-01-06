import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Project, Entity, Feature, AIConfig } from "../types";

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

// Timeout wrapper for fetch requests
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs: number = 5000): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

/**
 * ============================================================================
 * IMAGE FETCHING SYSTEM - Multi-source approach for maximum reliability
 * ============================================================================
 * Priority order:
 * 1. Biodiversity4All (Portuguese/Iberian biodiversity via iNaturalist API)
 * 2. iNaturalist API (best for biodiversity - has curated species photos)
 * 3. Flickr (disabled due to CORS - included as reference link only)
 * 4. Wikipedia/Wikimedia Commons (good general coverage)
 * 5. Wikimedia Commons direct search
 * 6. PlantNet (AI-powered plant identification with extensive photo database)
 * 7. POWO - Plants of the World Online (Kew Gardens - herbarium specimens/exsicatas)
 */

/**
 * Fetch image from iNaturalist API - Best source for species/biodiversity
 * Uses the taxa search endpoint which returns photos from research-grade observations
 */
async function fetchINaturalistImage(searchTerm: string, expectedScientificName?: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      q: searchTerm,
      per_page: '3', // Request a few to filter
      locale: 'pt-BR'
    });

    const response = await fetchWithTimeout(`https://api.inaturalist.org/v1/taxa?${params}`, {}, 5000);
    if (!response.ok) return null;

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      // If we have an expected scientific name, filter results
      let bestMatch = data.results[0];

      if (expectedScientificName) {
        // Find a result that matches the scientific name
        const cleanExpected = expectedScientificName.toLowerCase().trim();
        const expectedBinomial = extractBinomial(cleanExpected).toLowerCase();

        const match = data.results.find((r: any) => {
          const rName = r.name.toLowerCase();
          const rBinomial = extractBinomial(rName).toLowerCase();

          // Strict binomial match prevents Genus vs Species mixups
          // e.g. "Panthera" (Genus) should NOT match "Panthera leo" (Species)
          if (rBinomial === expectedBinomial) return true;

          // Fallback: if result contains expected (e.g. result has author)
          if (rName.includes(cleanExpected)) return true;

          return false;
        });

        if (match) {
          bestMatch = match;
        } else {
          // If searching by common name and result is completely different species, abort
          // But if searching by scientific name, likely fine.
          const isScientificSearch = searchTerm.toLowerCase().includes(cleanExpected);
          if (!isScientificSearch) {
            // Term was common name, results don't match expected scientific name -> Reject
            console.log(`[iNat] Rejecting "${searchTerm}" result "${bestMatch.name}" (expected "${expectedScientificName}")`);
            return null;
          }
        }
      }

      const taxon = bestMatch;

      // iNaturalist provides multiple photo sizes - use medium (500px max)
      if (taxon.default_photo?.medium_url) {
        return taxon.default_photo.medium_url;
      }
      // Fallback to square if medium not available
      if (taxon.default_photo?.square_url) {
        // Convert square to medium size
        return taxon.default_photo.square_url.replace('/square.', '/medium.');
      }
    }

    return null;
  } catch (error) {
    console.warn(`iNaturalist fetch failed for "${searchTerm}":`, error);
    return null;
  }
}

/**
 * Fetch image from Flickr using public search API
 * DISABLED: Flickr's public API has CORS restrictions that prevent browser calls
 * https://www.flickr.com/
 */
async function fetchFlickrImage(searchTerm: string): Promise<string | null> {
  // Flickr's public API blocks CORS requests from browsers
  // This function is disabled to prevent console errors
  // Flickr is still included as a reference link in generateEntityLinks()
  return null;
}

/**
 * Fetch image from Flora Digital UFSC
 * Excellent source for Brazilian flora
 * https://floradigital.ufsc.br/
 */
async function fetchFloraDigitalImage(searchTerm: string): Promise<string | null> {
  try {
    // Flora Digital doesn't have a public API, but we can try to construct
    // a search URL and note it as a reference source
    // For now, we return null as it requires scraping
    // The site will be added as a reference link instead
    return null;
  } catch (error) {
    console.warn(`Flora Digital UFSC fetch failed for "${searchTerm}":`, error);
    return null;
  }
}

/**
 * Fetch image from SIDOL (Sistema de Identificação Dendrológica Online)
 * Excellent source for Brazilian tree species
 * https://www.sidol.com.br/
 */
async function fetchSIDOLImage(searchTerm: string): Promise<string | null> {
  try {
    // SIDOL doesn't have a public API
    // The site will be added as a reference link for manual search
    return null;
  } catch (error) {
    console.warn(`SIDOL fetch failed for "${searchTerm}":`, error);
    return null;
  }
}

/**
 * Fetch image from Biodiversity4All (Portuguese iNaturalist network)
 * Great for Iberian/Portuguese biodiversity - uses iNaturalist API with place filter
 * https://www.biodiversity4all.org/
 */
async function fetchBiodiversity4AllImage(searchTerm: string, expectedScientificName?: string): Promise<string | null> {
  try {
    // Biodiversity4All uses the same iNaturalist API but we can filter by place
    // Place ID 7122 = Portugal, 6854 = Iberian Peninsula
    const params = new URLSearchParams({
      q: searchTerm,
      per_page: '3', // Get a few results to find best match
      locale: 'pt',
      preferred_place_id: '7122' // Portugal
    });

    const response = await fetchWithTimeout(`https://api.inaturalist.org/v1/taxa?${params}`, {}, 5000);
    if (!response.ok) return null;

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      let bestMatch = data.results[0];

      if (expectedScientificName) {
        const cleanExpected = expectedScientificName.toLowerCase().trim();
        const expectedBinomial = extractBinomial(cleanExpected).toLowerCase();

        const match = data.results.find((r: any) => {
          const rName = r.name.toLowerCase();
          const rBinomial = extractBinomial(rName).toLowerCase();

          if (rBinomial === expectedBinomial) return true;
          if (rName.includes(cleanExpected)) return true;

          return false;
        });

        if (match) {
          bestMatch = match;
        } else {
          const isScientificSearch = searchTerm.toLowerCase().includes(cleanExpected);
          if (!isScientificSearch) {
            return null;
          }
        }
      }

      const taxon = bestMatch;

      if (taxon.default_photo?.medium_url) {
        return taxon.default_photo.medium_url;
      }
      if (taxon.default_photo?.square_url) {
        return taxon.default_photo.square_url.replace('/square.', '/medium.');
      }
    }

    return null;
  } catch (error) {
    console.warn(`Biodiversity4All fetch failed for "${searchTerm}":`, error);
    return null;
  }
}

/**
 * Fetch image from Wikipedia using the pageimages API
 * Good for well-known species and general topics
 */
async function fetchWikipediaImage(entityName: string, language: string = 'pt'): Promise<string | null> {
  try {
    const wikis = language === 'pt' ? ['pt', 'en'] : ['en', 'pt'];

    for (const lang of wikis) {
      const wikiUrl = `https://${lang}.wikipedia.org/w/api.php`;

      const searchParams = new URLSearchParams({
        action: 'query',
        titles: entityName,
        prop: 'pageimages',
        pithumbsize: '400',
        format: 'json',
        origin: '*',
        redirects: '1'
      });

      const response = await fetchWithTimeout(`${wikiUrl}?${searchParams}`, {}, 5000);
      if (!response.ok) continue;

      const data = await response.json();
      const pages = data.query?.pages;

      if (pages) {
        const pageId = Object.keys(pages)[0];
        const page = pages[pageId];

        if (page && !page.missing && page.thumbnail?.source) {
          let imageUrl = page.thumbnail.source;
          // Try to get larger version
          imageUrl = imageUrl.replace(/\/\d+px-/, '/400px-');
          return imageUrl;
        }
      }
    }

    return null;
  } catch (error) {
    console.warn(`Wikipedia fetch failed for "${entityName}":`, error);
    return null;
  }
}

/**
 * Fetch image from Plant Illustrations - excellent source for botanical illustrations
 * http://plantillustrations.org/ - extensive collection of scientific botanical art
 */
async function fetchPlantIllustrationsImage(searchTerm: string): Promise<string | null> {
  try {
    // Plant Illustrations has a search API that returns illustrations
    // The site uses a simple search interface
    const searchUrl = `https://plantillustrations.org/api.php?action=opensearch&search=${encodeURIComponent(searchTerm)}&limit=5&format=json`;

    // Try alternative approach: direct search page scraping approach won't work,
    // so we use a pattern-based URL construction for known species
    // The site structure: plantillustrations.org/illustration.php?id_illustration=XXXXX

    // Try the Biodiversity Heritage Library API which indexes many botanical illustrations
    const bhlUrl = `https://www.biodiversitylibrary.org/api3?op=PublicationSearch&searchterm=${encodeURIComponent(searchTerm)}&searchtype=F&page=1&apikey=&format=json`;

    // Alternative: Use the BHL name search which often has botanical illustrations
    const bhlNameUrl = `https://www.biodiversitylibrary.org/api3?op=NameSearch&name=${encodeURIComponent(searchTerm)}&format=json`;

    const response = await fetchWithTimeout(bhlNameUrl, {}, 5000);
    if (!response.ok) return null;

    const data = await response.json();

    // BHL returns name records which may have associated illustrations
    if (data.Result && data.Result.length > 0) {
      const nameRecord = data.Result[0];
      if (nameRecord.BHLTITLE) {
        // Try to get illustrations from the title
        const titleUrl = `https://www.biodiversitylibrary.org/api3?op=GetTitleMetadata&id=${nameRecord.TitleID}&items=t&format=json`;
        const titleResponse = await fetchWithTimeout(titleUrl, {}, 5000);
        if (titleResponse.ok) {
          const titleData = await titleResponse.json();
          // Look for items with illustrations
          if (titleData.Result?.Items) {
            for (const item of titleData.Result.Items) {
              if (item.ThumbnailUrl) {
                return item.ThumbnailUrl;
              }
            }
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.warn(`Plant Illustrations/BHL fetch failed for "${searchTerm}":`, error);
    return null;
  }
}

/**
 * Fetch image from PlantNet - AI-powered plant identification platform
 * Has extensive crowdsourced photo database for plants worldwide
 * https://identify.plantnet.org/
 */
async function fetchPlantNetImage(searchTerm: string, expectedScientificName?: string): Promise<string | null> {
  try {
    // PlantNet has a species API that can return images
    // The API endpoint for species search
    const encodedTerm = encodeURIComponent(searchTerm);

    // Try PlantNet's species API (public endpoint)
    const response = await fetchWithTimeout(
      `https://api.plantnet.org/v1/species?q=${encodedTerm}&limit=1`,
      {
        headers: {
          'Accept': 'application/json'
        }
      },
      5000
    );

    if (!response.ok) {
      // PlantNet's public API may have restrictions
      // Try alternative: my-api.plantnet.org (public species search)
      const altResponse = await fetchWithTimeout(
        `https://my-api.plantnet.org/v2/species/search?q=${encodedTerm}&lang=pt`,
        { headers: { 'Accept': 'application/json' } },
        5000
      );

      if (!altResponse.ok) return null;

      const altData = await altResponse.json();
      if (altData.results && altData.results.length > 0) {
        const species = altData.results[0];
        // Check for images in the result
        if (species.images && species.images.length > 0) {
          const img = species.images[0];
          if (img.url?.m) return img.url.m; // medium size
          if (img.url?.s) return img.url.s; // small size
          if (img.url?.o) return img.url.o; // original
        }
      }
      return null;
    }

    const data = await response.json();

    // PlantNet returns species with images array
    if (data.results && data.results.length > 0) {
      for (const species of data.results) {
        // Validation: if we expect a specific scientific name, ensure this result matches
        if (expectedScientificName) {
          const resultName = (species.scientificName || species.name || "").toLowerCase();
          const expected = expectedScientificName.toLowerCase().trim();
          // Allow partial match (e.g. genus+species vs genus+species+author)
          // Also skip if result has no name to check against (safety)
          if (resultName && !resultName.includes(expected) && !expected.includes(resultName)) {
            continue;
          }
        }

        // Check for images
        if (species.images && species.images.length > 0) {
          const img = species.images[0];
          // PlantNet images have different size URLs
          if (img.url?.m) return img.url.m; // medium
          if (img.url?.s) return img.url.s; // small  
          if (img.url?.o) return img.url.o; // original
          if (typeof img.url === 'string') return img.url;
        }

        // Some responses have defaultImage
        if (species.defaultImage) {
          if (species.defaultImage.m) return species.defaultImage.m;
          if (species.defaultImage.s) return species.defaultImage.s;
        }
      }
    }

    // Direct species lookup if search didn't return images
    if (data.species) {
      if (data.species.images && data.species.images.length > 0) {
        const img = data.species.images[0];
        if (img.url?.m) return img.url.m;
        if (img.url?.s) return img.url.s;
      }
    }

    return null;
  } catch (error) {
    console.warn(`PlantNet fetch failed for "${searchTerm}":`, error);
    return null;
  }
}

/**
 * Fetch image from POWO (Plants of the World Online) - Kew Gardens
 * Excellent source for herbarium specimen images (exsicatas) and botanical illustrations
 * Uses the public Kew API to search for plant images
 * https://powo.science.kew.org/
 */
async function fetchPOWOImage(searchTerm: string, expectedScientificName?: string): Promise<string | null> {
  try {
    // POWO uses Kew's public API for plant name lookups
    // First, search for the species in POWO
    const searchParams = new URLSearchParams({
      q: searchTerm,
      f: 'accepted_names' // Only accepted names
    });

    const searchResponse = await fetchWithTimeout(
      `https://powo.science.kew.org/api/2/search?${searchParams}`,
      { headers: { 'Accept': 'application/json' } },
      5000
    );

    if (!searchResponse.ok) {
      // Try alternative endpoint: IPNI (International Plant Names Index)
      const ipniParams = new URLSearchParams({
        q: searchTerm,
        perPage: '1'
      });

      const ipniResponse = await fetchWithTimeout(
        `https://www.ipni.org/api/1/search?${ipniParams}`,
        { headers: { 'Accept': 'application/json' } },
        5000
      );

      if (!ipniResponse.ok) return null;

      const ipniData = await ipniResponse.json();
      if (ipniData.results && ipniData.results.length > 0) {
        const firstResult = ipniData.results[0];
        // IPNI links to POWO - construct the image URL if available
        if (firstResult.fqId) {
          const powoUrl = `https://powo.science.kew.org/taxon/${firstResult.fqId}`;
          // Return a thumbnail placeholder - POWO doesn't have direct image API
          // This signals to fetch from POWO page directly
          return null; // We can't get direct images from IPNI/POWO without scraping
        }
      }
      return null;
    }

    const data = await searchResponse.json();

    // POWO search results contain image URLs for some species
    if (data.results && data.results.length > 0) {
      for (const result of data.results) {
        // Validation
        if (expectedScientificName) {
          const resultName = (result.name || "").toLowerCase();
          const expected = expectedScientificName.toLowerCase().trim();
          if (resultName && !resultName.includes(expected) && !expected.includes(resultName)) {
            continue;
          }
        }

        // Check for image in the result
        if (result.images && result.images.length > 0) {
          const image = result.images[0];
          // POWO images typically come from various herbarium collections
          if (image.url) {
            return image.url;
          }
          if (image.thumbnail) {
            return image.thumbnail;
          }
        }

        // If no image in search results, try to get taxon details
        if (result.fqId) {
          try {
            const taxonResponse = await fetchWithTimeout(
              `https://powo.science.kew.org/api/2/taxon/${result.fqId}`,
              { headers: { 'Accept': 'application/json' } },
              5000
            );

            if (taxonResponse.ok) {
              const taxonData = await taxonResponse.json();

              // Check for images in taxon details
              if (taxonData.images && taxonData.images.length > 0) {
                const img = taxonData.images[0];
                if (img.url) return img.url;
                if (img.thumbnail) return img.thumbnail;
              }

              // Check for distribution/specimen images
              if (taxonData.distribution?.images?.length > 0) {
                const distImg = taxonData.distribution.images[0];
                if (distImg.url) return distImg.url;
              }
            }
          } catch (e) {
            // Taxon lookup failed, continue to next result
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.warn(`POWO fetch failed for "${searchTerm}":`, error);
    return null;
  }
}

/**
 * Fetch image from Wikimedia Commons - good for scientific/biological content
 */
async function fetchWikimediaCommonsImage(searchTerm: string): Promise<string | null> {
  try {
    const commonsUrl = 'https://commons.wikimedia.org/w/api.php';
    const params = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrsearch: `${searchTerm}`,
      gsrnamespace: '6', // File namespace
      gsrlimit: '5', // Get more results to filter through
      prop: 'imageinfo',
      iiprop: 'url|mime',
      iiurlwidth: '400',
      format: 'json',
      origin: '*'
    });

    const response = await fetchWithTimeout(`${commonsUrl}?${params}`, {}, 5000);
    if (!response.ok) return null;

    const data = await response.json();
    const pages = data.query?.pages;

    // URLs/patterns to reject - these are not species-specific photos
    const rejectedPatterns = [
      // Book covers and historical publications
      /Flora_Brasiliensis/i,           // Flora Brasiliensis book covers
      /Flora_Fluminensis/i,            // Flora Fluminensis book covers
      /Systema_Naturae/i,              // Systema Naturae covers
      /Species_Plantarum/i,            // Species Plantarum covers
      /Genera_Plantarum/i,             // Genera Plantarum covers
      /Prodromus_Systematis/i,         // Prodromus covers
      /Historia_Naturalis/i,           // Historia Naturalis covers
      /\/page\d+-\d+px-/i,             // DjVu page thumbnails (book scans)
      /\.djvu\//i,                     // DjVu files (usually book scans)
      /Volume_\d+/i,                   // Volume indicators (book covers)
      /Part_\d+/i,                     // Part indicators combined with Volume
      /Book_cover/i,                   // Explicit book covers
      /Title_page/i,                   // Title pages
      /Frontispiece/i,                 // Frontispieces
      /Index_page/i,                   // Index pages
      /Table_of_contents/i,            // Table of contents
      /Herbarium_sheet_only/i,         // Generic herbarium references

      // Maps and geographic content
      /\.svg\//i,                      // SVG files (usually maps, diagrams, logos)
      /Municip[io_]/i,                 // Municipality maps (Municipio, Municip_)
      /Microregion/i,                  // Microregion maps
      /Mesoregion/i,                   // Mesoregion maps
      /Locator_map/i,                  // Locator maps
      /_location/i,                    // Location maps
      /_map\./i,                       // Generic maps
      /_in_Brazil/i,                   // "X in Brazil" location maps
      /_in_South_America/i,            // South America location maps
      /Brazil_location/i,              // Brazil location maps
      /Estado_de_/i,                   // State maps
      /Bandeira_de_/i,                 // Flags
      /Brasao_de_/i,                   // Coats of arms
      /Coat_of_arms/i,                 // Coats of arms (English)
      /Flag_of_/i,                     // Flags (English)

      // Diagrams, charts, and non-photographic content (but NOT botanical illustrations)
      /Phylogenetic_tree/i,            // Phylogenetic tree diagrams
      /Cladogram/i,                    // Cladograms (abstract diagrams)
      /Distribution_map/i,             // Distribution maps
      /Range_map/i,                    // Range maps
      /Logo[_\-]/i,                    // Logos
      /Icon[_\-]/i,                    // Icons
      /Stamp_of_/i,                    // Postage stamps
      /Coin_of_/i,                     // Coins
      /Infographic/i,                  // Infographics
    ];

    if (pages) {
      // Find first valid image (prefer jpg/png), filtering out rejected patterns
      for (const page of Object.values(pages) as any[]) {
        const info = page?.imageinfo?.[0];
        if (info?.thumburl && info?.mime?.startsWith('image/')) {
          const url = info.thumburl;

          // Check if URL matches any rejected pattern
          const isRejected = rejectedPatterns.some(pattern => pattern.test(url));
          if (isRejected) {
            console.log(`[Wikimedia] Rejected generic image: ${url.substring(0, 100)}...`);
            continue; // Skip this image, try next
          }

          return url;
        }
      }
    }

    return null;
  } catch (error) {
    console.warn(`Wikimedia Commons fetch failed for "${searchTerm}":`, error);
    return null;
  }
}

/**
 * Extract genus and species epithet from a scientific name (removes author citation)
 * Examples:
 *   "Inga vera Willd." → "Inga vera"
 *   "Swartzia simplex (Sw.) Spreng." → "Swartzia simplex"
 *   "Andira fraxinifolia Benth." → "Andira fraxinifolia"
 */
export function extractBinomial(name: string): string {
  if (!name) return '';

  // Remove any text in parentheses at the end (author abbreviations like "(Sw.)")
  let cleaned = name.replace(/\s*\([^)]*\)\s*/g, ' ').trim();

  // Check if this looks like a family name (ends in -aceae, -idae, -ales, etc.)
  // Family names should NOT be used for image search - return empty to skip
  if (/^[A-Z][a-z]+(aceae|idae|ales|ineae|oidea|iformes)$/i.test(cleaned)) {
    return ''; // Return empty for family names
  }

  // Split by spaces and take only the first two words (genus + epithet)
  const parts = cleaned.split(/\s+/);

  // If we have at least 2 parts, return genus + epithet
  if (parts.length >= 2) {
    // Check if second part looks like a species epithet (lowercase, no punctuation)
    const genus = parts[0];
    const epithet = parts[1];

    // Skip if epithet looks like a family suffix
    if (/^(aceae|idae|ales|ineae|oidea|iformes)$/i.test(epithet)) {
      return genus; // Return just the genus
    }

    // Return only if epithet looks valid (starts lowercase, no author-like patterns)
    if (/^[a-z]/.test(epithet) && !epithet.includes('.')) {
      return `${genus} ${epithet}`;
    }
  }

  // If single word and not a family name, return as-is (could be genus)
  if (parts.length === 1 && !/aceae|idae|ales$/i.test(parts[0])) {
    return parts[0];
  }

  // Fallback: return original if we can't parse it (but not family names)
  return cleaned;
}

/**
 * Main function: Fetch a valid image URL using multi-source fallback strategy
 * Tries sources in order of reliability for biological/species content
 * Order: Biodiversity4All → iNaturalist → Wikipedia → Wikimedia Commons
 */
async function fetchEntityImage(
  entityName: string,
  scientificName?: string,
  language: string = 'pt',
  category: 'FLORA' | 'FAUNA' | 'OTHER' = 'FLORA'
): Promise<string | null> {
  // Build search terms - clean scientific name first (genus + epithet only), then common name
  const cleanScientificName = scientificName ? extractBinomial(scientificName) : null;
  const cleanEntityName = extractBinomial(entityName);

  // Prioritize clean binomial, then try original names as fallback
  const searchTerms = [
    cleanScientificName,
    cleanEntityName,
    // Fallback to original names if cleaning changed them significantly
    scientificName !== cleanScientificName ? scientificName : null,
    entityName !== cleanEntityName ? entityName : null
  ].filter(Boolean) as string[];

  // Remove duplicates
  const uniqueTerms = [...new Set(searchTerms)];

  for (const term of uniqueTerms) {
    // Pass expectedScientificName for validation ONLY if we are searching for a broad term (like common name)
    // or specifically validation against known scientific name.
    // If 'term' IS the scientific name, we don't strictly need validation, but it doesn't hurt.
    // Ideally we pass 'cleanScientificName' or 'scientificName' as expected.
    const expected = cleanScientificName || scientificName;

    if (category === 'FLORA' || category === 'FAUNA') {
      // 1. Try Biodiversity4All first (Portuguese/Iberian biodiversity - https://www.biodiversity4all.org/)
      const b4aImage = await fetchBiodiversity4AllImage(term, expected);
      if (b4aImage) return b4aImage;

      // 2. Try iNaturalist global (best for worldwide biodiversity)
      const iNatImage = await fetchINaturalistImage(term, expected);
      if (iNatImage) return iNatImage;
    }

    // 3. Try Flickr (large public photo database - https://www.flickr.com/)
    const flickrImage = await fetchFlickrImage(term);
    if (flickrImage) return flickrImage;

    // 4. Try Wikipedia
    const wikiImage = await fetchWikipediaImage(term, language);
    if (wikiImage) return wikiImage;

    if (category === 'FLORA') {
      // 5. Try Plant Illustrations / BHL (excellent botanical illustrations)
      const illustrationImage = await fetchPlantIllustrationsImage(term);
      if (illustrationImage) return illustrationImage;
    }

    // 6. Try Wikimedia Commons
    const commonsImage = await fetchWikimediaCommonsImage(term);
    if (commonsImage) return commonsImage;

    if (category === 'FLORA') {
      // 7. Try PlantNet (AI plant identification with extensive photo database)
      const plantNetImage = await fetchPlantNetImage(term, expected); // TODO: Add validation support for PlantNet if needed
      if (plantNetImage) return plantNetImage;

      // 8. Try POWO (Plants of the World Online) - last resort for botanical specimens/exsicatas
      const powoImage = await fetchPOWOImage(term, expected);
      if (powoImage) return powoImage;
    }
  }

  return null;
}

/**
 * Fetch image for a feature state (morphology/diagrams)
 * Prioritizes botanical illustrations and diagrams over photos
 */
async function fetchFeatureStateImage(
  featureName: string,
  stateLabel: string,
  language: string = 'pt',
  category: 'FLORA' | 'FAUNA' | 'OTHER' = 'FLORA'
): Promise<string | null> {
  // Construct search queries optimized for morphology
  // E.g. "Leaf arrangement alternate diagram", "Folha filotaxia alterna"

  // Clean names
  const cleanFeature = featureName.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').trim();
  const cleanState = stateLabel.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').trim();

  // 1. Try DIRECT KNOWN MAP (Hardcoded fallbacks for common traits)
  // This ensures high quality diagrams for standard terms
  const fallbackUrl = getCommonMorphologyImage(cleanFeature, cleanState, language);
  if (fallbackUrl) return fallbackUrl;

  // 2. Build search terms
  let terms: string[] = [];

  if (language === 'pt') {
    terms = [
      `${cleanFeature} ${cleanState} botânica`,
      `${cleanState} morfologia vegetal`,
      `${cleanState} ${cleanFeature} desenho`,
      `${cleanState} botanical illustration` // English fallback often works better
    ];
  } else {
    terms = [
      `${cleanFeature} ${cleanState} botanical illustration`,
      `${cleanState} plant morphology`,
      `${cleanState} leaf shape`
    ];
  }

  // 3. Search Loop
  for (const term of terms) {
    // Try Wikimedia Commons (best for diagrams)
    const commonsImage = await fetchWikimediaCommonsImage(term);
    if (commonsImage) return commonsImage;

    // Try Plant Illustrations (excellent for drawn traits)
    if (category === 'FLORA') {
      const illustration = await fetchPlantIllustrationsImage(term);
      if (illustration) return illustration;
    }
  }

  return null;
}

/**
 * Get known URL for common morphological traits
 * Serves as a reliable fallback for standard botanical terms
 */
function getCommonMorphologyImage(feature: string, state: string, language: string): string | null {
  // Normalize strings
  const f = feature.toLowerCase();
  const s = state.toLowerCase();

  // Map of terms to Wikimedia Commons URLs (Public Domain / CC)
  // These are examples - in a real production env, these would be local assets or carefully curated URLs

  // LEAF ARRANGEMENT (Filotaxia)
  if (f.includes('files') || f.includes('filotaxia') || f.includes('arrangement') || f.includes('disposição')) {
    if (s.includes('altern') || s.includes('alternad'))
      return "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Phyllotaxis_Alternate.svg/200px-Phyllotaxis_Alternate.svg.png";
    if (s.includes('opost') || s.includes('opposit'))
      return "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Phyllotaxis_Opposite.svg/200px-Phyllotaxis_Opposite.svg.png";
    if (s.includes('verticila') || s.includes('whorl'))
      return "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Phyllotaxis_Whorled.svg/200px-Phyllotaxis_Whorled.svg.png";
    if (s.includes('rosulad') || s.includes('rosette'))
      return "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Plant_Rozeut_01.svg/200px-Plant_Rozeut_01.svg.png";
  }

  // LEAF COMPOSITION (Composição)
  if (f.includes('composição') || f.includes('composition') || f.includes('tipo') || f.includes('type')) {
    if (s.includes('simpl'))
      return "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Leaf_morphology_simple.png/200px-Leaf_morphology_simple.png";
    if (s.includes('pinad') || s.includes('pinnat'))
      return "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Leaf_morphology_imparipinnate.png/200px-Leaf_morphology_imparipinnate.png"; // Generic pinnate
    if (s.includes('bipinad') || s.includes('bipinnat'))
      return "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Leaf_morphology_bipinnate.png/200px-Leaf_morphology_bipinnate.png";
    if (s.includes('palmad') || s.includes('palmat') || s.includes('digitad'))
      return "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Leaf_morphology_palmately_compound.png/200px-Leaf_morphology_palmately_compound.png";
    if (s.includes('trifolio') || s.includes('trifoliolat'))
      return "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Leaf_morphology_trifoliate.png/200px-Leaf_morphology_trifoliate.png";
  }

  // LEAF MARGIN (Margem)
  if (f.includes('margem') || f.includes('margin') || f.includes('borda')) {
    if (s.includes('inteir') || s.includes('entire'))
      return "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Leaf_margin_entire.png/200px-Leaf_margin_entire.png";
    if (s.includes('serre') || s.includes('serrad') || s.includes('serrate'))
      return "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Leaf_margin_serrate.png/200px-Leaf_margin_serrate.png";
    if (s.includes('dentead') || s.includes('dentate'))
      return "https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Leaf_margin_dentate.png/200px-Leaf_margin_dentate.png";
    if (s.includes('crenad') || s.includes('crenate'))
      return "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Leaf_margin_crenate.png/200px-Leaf_margin_crenate.png";
    if (s.includes('lobad') || s.includes('lobed'))
      return "https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Leaf_margin_lobate.png/200px-Leaf_margin_lobate.png";
  }

  // LEAF SHAPE (Forma)
  if (f.includes('forma') || f.includes('shape')) {
    if (s.includes('elíptic') || s.includes('elliptic'))
      return "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Leaf_morphology_elliptic.png/200px-Leaf_morphology_elliptic.png";
    if (s.includes('ovad') || s.includes('ovate'))
      return "https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Leaf_morphology_ovate.png/200px-Leaf_morphology_ovate.png";
    if (s.includes('lanceolad') || s.includes('lanceolat'))
      return "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Leaf_morphology_lanceolate.png/200px-Leaf_morphology_lanceolate.png";
    if (s.includes('line') || s.includes('linear'))
      return "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Leaf_morphology_linear.png/200px-Leaf_morphology_linear.png";
    if (s.includes('obovad') || s.includes('obovate'))
      return "https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Leaf_morphology_obovate.png/200px-Leaf_morphology_obovate.png";
    if (s.includes('cordad') || s.includes('cordate'))
      return "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Leaf_morphology_cordate.png/200px-Leaf_morphology_cordate.png";
  }

  // VENATION (Nervação)
  if (f.includes('nervação') || f.includes('venation') || f.includes('nervura')) {
    if (s.includes('peninérv') || s.includes('pinnate'))
      return "https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Venation_Pinnate.svg/200px-Venation_Pinnate.svg.png";
    if (s.includes('palminérv') || s.includes('palmate'))
      return "https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Venation_Palmate.svg/200px-Venation_Palmate.svg.png";
    if (s.includes('paralel') || s.includes('parallel'))
      return "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Venation_Parallel.svg/200px-Venation_Parallel.svg.png";
  }

  return null;
}

/**
 * Batch fetch images for multiple entities with progress callback
 * Uses parallel requests with rate limiting to avoid API throttling
 */
export async function fetchImagesForEntities(
  entities: Array<{ name: string; scientificName?: string }>,
  language: string = 'pt',
  onProgress?: (current: number, total: number, entityName: string) => void,
  category: 'FLORA' | 'FAUNA' | 'OTHER' = 'FLORA'
): Promise<Map<string, string>> {
  const imageMap = new Map<string, string>();
  const batchSize = 3; // Conservative to respect API limits

  for (let i = 0; i < entities.length; i += batchSize) {
    const batch = entities.slice(i, i + batchSize);

    const promises = batch.map(async (entity) => {
      const imageUrl = await fetchEntityImage(entity.name, entity.scientificName, language, category);
      return { name: entity.name, url: imageUrl, scientificName: entity.scientificName };
    });

    const results = await Promise.all(promises);

    results.forEach(result => {
      if (result.url) {
        imageMap.set(result.name, result.url);
      }
    });

    if (onProgress) {
      const current = Math.min(i + batchSize, entities.length);
      // Use scientific name for log if available, otherwise common name
      const lastItem = results[results.length - 1];
      const displayName = lastItem?.scientificName || lastItem?.name || '';
      onProgress(current, entities.length, displayName);
    }

    // Delay between batches (100ms to stay under 60 req/min for iNaturalist)
    if (i + batchSize < entities.length) {
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }

  return imageMap;
}

/**
 * Generate a consistent placeholder URL based on entity name
 * DEPRECATED: Now returns empty string to avoid mockup images
 * Real images should come from API searches only
 */
function getPlaceholderImage(entityName: string): string {
  // Return empty string - no more mockup/placeholder images
  // This ensures only real images are displayed
  return '';
}

/**
 * Generate reliable reference links for a biological entity
 * Uses known URL patterns from reputable databases
 */
export function generateEntityLinks(scientificName: string, family: string, language: string): Array<{ id: string; label: string; url: string }> {
  const links: Array<{ id: string; label: string; url: string }> = [];

  if (!scientificName || scientificName.length < 3) return links;

  // Clean and encode the scientific name
  const cleanName = scientificName.trim();
  const encodedName = encodeURIComponent(cleanName);
  const underscoreName = cleanName.replace(/\s+/g, '_');

  // 1. Wikipedia - always works as a search
  const wikiLang = language === 'pt' ? 'pt' : 'en';
  links.push({
    id: generateId(),
    label: 'Wikipedia',
    url: `https://${wikiLang}.wikipedia.org/wiki/Special:Search?search=${encodedName}&go=Go`
  });

  // 2. GBIF (Global Biodiversity Information Facility) - best for occurrence data
  links.push({
    id: generateId(),
    label: 'GBIF',
    url: `https://www.gbif.org/species/search?q=${encodedName}`
  });

  // 3. iNaturalist - best for photos and observations
  links.push({
    id: generateId(),
    label: 'iNaturalist',
    url: `https://www.inaturalist.org/search?q=${encodedName}`
  });

  // 4. Add Flora e Funga do Brasil for Portuguese/Brazilian species
  if (language === 'pt') {
    const plusName = cleanName.replace(/\s+/g, '+');
    links.push({
      id: generateId(),
      label: 'Flora e Funga do Brasil',
      url: `https://floradobrasil.jbrj.gov.br/consulta/?nomeCompleto=${plusName}`
    });
  }

  // 5. Biodiversity4All for Portuguese content
  if (language === 'pt') {
    links.push({
      id: generateId(),
      label: 'Biodiversity4All',
      url: `https://www.biodiversity4all.org/search?q=${encodedName}`
    });
  }

  // 6. SIDOL (Sistema de Identificação Dendrológica Online) - for Brazilian trees
  if (language === 'pt') {
    links.push({
      id: generateId(),
      label: 'SIDOL',
      url: `https://www.sidol.com.br/busca?q=${encodedName}`
    });
  }

  // 7. Flora Digital UFSC - for Brazilian flora
  if (language === 'pt') {
    links.push({
      id: generateId(),
      label: 'Flora Digital UFSC',
      url: `https://floradigital.ufsc.br/busca.php?q=${encodedName}`
    });
  }

  // 8. Flickr - large public photo database
  links.push({
    id: generateId(),
    label: 'Flickr',
    url: `https://www.flickr.com/search/?text=${encodedName}`
  });

  // 9. POWO (Plants of the World Online) - for plants
  links.push({
    id: generateId(),
    label: 'POWO',
    url: `https://powo.science.kew.org/results?q=${encodedName}`
  });

  // Limit to 5 most relevant links (increased from 4)
  return links.slice(0, 5);
}

/**
 * Try to extract scientific name from entity name
 * Handles common patterns like "Entity (Scientific Name)" or "Scientific Name"
 */
function extractScientificName(entityName: string): string | null {
  // Check for pattern: "Common Name (Scientific Name)"
  const parenMatch = entityName.match(/\(([A-Z][a-z]+ [a-z]+[^)]*)\)/);
  if (parenMatch) return parenMatch[1];

  // Check if the name itself looks like a scientific name (Genus species)
  const binomialPattern = /^([A-Z][a-z]+)\s+([a-z]+)(\s+.*)?$/;
  if (binomialPattern.test(entityName)) return entityName.split(/\s+-\s+/)[0].trim();

  return null;
}

// Helper to attempt to repair truncated JSON
const repairTruncatedJson = (jsonStr: string): any => {
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.warn("JSON truncated. Attempting repair...");

    let repaired = jsonStr.trim();

    // 1. If we're in the middle of a string, we need to handle it first
    // This is often the cause of failures in other strategies
    const fixUnterminatedString = (str: string) => {
      let inString = false;
      let escaped = false;
      for (let i = 0; i < str.length; i++) {
        if (escaped) {
          escaped = false;
        } else if (str[i] === '\\') {
          escaped = true;
        } else if (str[i] === '"') {
          inString = !inString;
        }
      }
      if (inString) {
        return str + '"';
      }
      return str;
    };

    // 2. Try multiple repair strategies
    const strategies = [
      // Strategy 1: Simple bracket closing with unterminated string check
      () => {
        console.log("Strategy 1: Closing brackets...");
        let str = fixUnterminatedString(repaired);
        // Remove trailing comma
        str = str.replace(/,\s*$/, '');

        // Count and close brackets
        const stack: string[] = [];
        let inString = false;
        let escaped = false;

        for (let i = 0; i < str.length; i++) {
          const char = str[i];
          if (escaped) { escaped = false; continue; }
          if (char === '\\') { escaped = true; continue; }
          if (char === '"') { inString = !inString; continue; }

          if (!inString) {
            if (char === '{') stack.push('}');
            else if (char === '[') stack.push(']');
            else if (char === '}' || char === ']') {
              if (stack.length > 0 && stack[stack.length - 1] === char) {
                stack.pop();
              }
            }
          }
        }

        str += stack.reverse().join('');
        return JSON.parse(str);
      },

      // Strategy 2: Truncate to last complete entity and close
      () => {
        console.log("Strategy 2: Truncating to last complete entity...");
        let str = repaired;

        // Find the last complete "traitsMap": "{...}" or the last complete entity
        // We look for patterns like "}," or "}]"
        const lastEntityEnd = Math.max(str.lastIndexOf('},'), str.lastIndexOf('}]'));
        if (lastEntityEnd > 0) {
          str = str.substring(0, lastEntityEnd + 1);
        }

        str = fixUnterminatedString(str);

        // Close remaining brackets
        const stack: string[] = [];
        let inString = false;
        let escaped = false;

        for (let i = 0; i < str.length; i++) {
          const char = str[i];
          if (escaped) { escaped = false; continue; }
          if (char === '\\') { escaped = true; continue; }
          if (char === '"') { inString = !inString; continue; }
          if (!inString) {
            if (char === '{') stack.push('}');
            else if (char === '[') stack.push(']');
            else if ((char === '}' || char === ']') && stack.length > 0 && stack[stack.length - 1] === char) {
              stack.pop();
            }
          }
        }

        str += stack.reverse().join('');
        return JSON.parse(str);
      },

      // Strategy 3: Dynamic walk-back to find last parseable chunk (OPTIMIZED)
      () => {
        console.log("Strategy 3: Dynamic walk-back (Optimized)...");
        let str = repaired;
        const minLen = Math.floor(str.length * 0.4); // Don't go below 40%

        // Walk backwards to find a good cutoff point
        // OPTIMIZATION: Only check at closing braces/brackets to avoid thousands of JSON.parse calls
        for (let i = str.length - 1; i > minLen; i--) {
          const char = str[i];
          // Only attempt parse if we are at a closing structure or comma
          if (char !== '}' && char !== ']') continue;

          const substr = str.substring(0, i + 1);
          try {
            // Remove trailing comma if present (shouldn't be if we check } or ])
            // But if we are at '}', maybe followed by ',' in original, substr includes '}'

            let test = fixUnterminatedString(substr);

            // Balance brackets for this chunk
            const stack: string[] = [];
            let inStr = false;
            let esc = false;
            for (const c of test) {
              if (esc) { esc = false; }
              else if (c === '\\') { esc = true; }
              else if (c === '"') { inStr = !inStr; }
              else if (!inStr) {
                if (c === '{') stack.push('}');
                else if (c === '[') stack.push(']');
                else if ((c === '}' || c === ']') && stack.length && stack[stack.length - 1] === c) stack.pop();
              }
            }
            test += stack.reverse().join('');

            const parsed = JSON.parse(test);
            // Check if we got something useful
            if ((parsed.entities && parsed.entities.length > 0) ||
              (parsed.features && parsed.features.length > 0) ||
              (parsed.filledEntities && parsed.filledEntities.length > 0)) {
              console.log(`Strategy 3 success at index ${i}`);
              return parsed;
            }
          } catch { /* continue */ }
        }
        throw new Error("Strategy 3 failed");
      },

      // Strategy 4: Regex-based entity extraction (Last Resort)
      () => {
        console.warn("Strategy 4: Attempting regex-based entity extraction...");
        const entityPattern = /{[^{}]*"id"\s*:\s*"[^"]+"[^{}]*}/g;
        const matches = repaired.match(entityPattern);
        if (matches && matches.length > 0) {
          const entities = [];
          for (const match of matches) {
            try {
              entities.push(JSON.parse(match));
            } catch { /* skip invalid partial match */ }
          }
          if (entities.length > 0) {
            return { entities };
          }
        }
        throw new Error("Strategy 4 failed");
      }
    ];

    // Try each strategy
    for (let i = 0; i < strategies.length; i++) {
      try {
        const startTime = Date.now();
        const result = strategies[i]();
        console.log(`JSON repair successful with strategy ${i + 1} (${Date.now() - startTime}ms)`);
        return result;
      } catch (err) {
        // Continue to next strategy
      }
    }

    console.error("All repair strategies failed. Returning empty object to prevent process crash.");
    return {}; // Return empty object instead of throwing
  }
};

// Common Schema Definitions
const baseFeatureSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Name of the feature (e.g., 'Wing Color')" },
    imageUrl: { type: Type.STRING, description: "URL for feature illustration" },
    states: {
      type: Type.ARRAY,
      items: { type: Type.STRING, description: "A state description (e.g., 'Blue')" }
    }
  },
  required: ["name", "states"]
};

const linkSchema = {
  type: Type.OBJECT,
  properties: {
    label: { type: Type.STRING, description: "Title of the link (e.g., 'Wikipedia', 'GBIF')" },
    url: { type: Type.STRING, description: "Full URL" }
  },
  required: ["label", "url"]
};

// Standard Schema (Verbose/Strict for Generation)
const generationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    projectName: { type: Type.STRING },
    projectDescription: { type: Type.STRING },
    features: {
      type: Type.ARRAY,
      items: baseFeatureSchema
    },
    entities: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Entity name (can be common name or scientific name)" },
          id: { type: Type.STRING, description: "Preserve original ID if available" },
          imageUrl: { type: Type.STRING, description: "Preserve original image URL if available" },
          scientificName: { type: Type.STRING, description: "Scientific binomial name (e.g., 'Panthera leo'). REQUIRED for biological species." },
          family: { type: Type.STRING, description: "Taxonomic family name (e.g., 'Felidae', 'Fabaceae'). REQUIRED for biological species." },
          description: { type: Type.STRING },
          links: { type: Type.ARRAY, items: linkSchema, description: "External resources" },
          traits: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                featureName: { type: Type.STRING, description: "Must match one of the feature names exactly" },
                stateValue: { type: Type.STRING, description: "Must match one of the state values for that feature exactly" }
              },
              required: ["featureName", "stateValue"]
            }
          }
        },
        required: ["name", "scientificName", "description", "traits"]
      }
    }
  },
  required: ["projectName", "projectDescription", "features", "entities"]
};

// Optimized Schema for Import (Uses string array for traits to save tokens on large lists)
const importSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    projectName: { type: Type.STRING },
    projectDescription: { type: Type.STRING },
    features: {
      type: Type.ARRAY,
      items: baseFeatureSchema
    },
    entities: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Entity name as found in document" },
          scientificName: { type: Type.STRING, description: "Scientific binomial name if available (e.g., 'Panthera leo')" },
          family: { type: Type.STRING, description: "Taxonomic family name if available (e.g., 'Felidae', 'Fabaceae')" },
          description: { type: Type.STRING },
          links: { type: Type.ARRAY, items: linkSchema, description: "External resources" },
          traits: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                featureName: { type: Type.STRING, description: "Must match one of the feature names exactly" },
                stateValue: { type: Type.STRING, description: "Must match one of the state values for that feature exactly" }
              },
              required: ["featureName", "stateValue"]
            }
          }
        },
        required: ["name", "scientificName", "description", "traits"]
      }
    }
  },
  required: ["projectName", "projectDescription", "features", "entities"]
};

// Schema for REFINE operations - preserves ID format to avoid complex remapping
// Uses the SAME ID format as the project: traits = { featureId: [stateId, stateId, ...] }
const refineSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    features: {
      type: Type.ARRAY,
      description: "Optional: new features to add. If not adding features, can be omitted or empty array.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Generate a new unique ID for new features (9 random chars)" },
          name: { type: Type.STRING, description: "Feature name" },
          imageUrl: { type: Type.STRING, description: "Optional image URL for the feature" },
          states: {
            type: Type.ARRAY,
            description: "At least 2 states required",
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING, description: "Generate a new unique ID for each state (9 random chars)" },
                label: { type: Type.STRING, description: "State label/value" },
                imageUrl: { type: Type.STRING, description: "Optional image URL for this state" }
              },
              required: ["id", "label"]
            }
          }
        },
        required: ["id", "name", "states"]
      }
    },
    entities: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "REQUIRED: The exact entity ID from the input - MUST preserve original ID exactly" },
          name: { type: Type.STRING, description: "Entity name - MUST preserve original name if not explicitly changing" },
          scientificName: { type: Type.STRING, description: "Scientific binomial name - MUST preserve original if present" },
          family: { type: Type.STRING, description: "Taxonomic family name - MUST preserve original if present" },
          description: { type: Type.STRING, description: "Entity description - can be enhanced" },
          traitsMap: {
            type: Type.STRING,
            description: "JSON string of traits object in format {\"featureId\": [\"stateId\", ...]} - MUST use exact IDs from input AND new feature IDs if adding features"
          }
        },
        required: ["id", "name", "scientificName", "traitsMap"]
      }
    },
    stats: {
      type: Type.OBJECT,
      properties: {
        processedCount: { type: Type.NUMBER, description: "Number of entities processed" },
        modifiedCount: { type: Type.NUMBER, description: "Number of entities with added/changed traits" },
        skippedCount: { type: Type.NUMBER, description: "Number of entities skipped (no changes needed)" },
        featuresAdded: { type: Type.NUMBER, description: "Number of new features added" }
      }
    }
  },
  required: ["entities"]
};

// Schema for fillGaps - minimal output, just entity ID + traits that were filled
const fillGapsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    filledEntities: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          entityId: { type: Type.STRING, description: "The exact entity ID from input" },
          filledTraits: {
            type: Type.ARRAY,
            description: "List of traits to add",
            items: {
              type: Type.OBJECT,
              properties: {
                featureId: { type: Type.STRING },
                stateIds: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["featureId", "stateIds"]
            }
          }
        },
        required: ["entityId", "filledTraits"]
      }
    },
    stats: {
      type: Type.OBJECT,
      properties: {
        entitiesWithGaps: { type: Type.NUMBER },
        traitsAdded: { type: Type.NUMBER }
      }
    }
  },
  required: ["filledEntities"]
};

// Schema for VALIDATE operations - returns only validation results
const validationResultSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    validatedEntities: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Original Entity ID (exact match)" },
          isValid: { type: Type.BOOLEAN, description: "Whether the entity passed validation criteria" },
          scientificName: { type: Type.STRING, description: "Corrected scientific binomial name (e.g. 'Genus species')" },
          family: { type: Type.STRING, description: "Corrected taxonomic family" },
          correctionNote: { type: Type.STRING, description: "Reason for correction or removal, or empty if valid" }
        },
        required: ["id", "isValid", "scientificName", "family"]
      }
    }
  },
  required: ["validatedEntities"]
};

interface PromptData {
  systemInstruction: string;
  prompt: string;
  schema: Schema;
  parts?: any[];
}

/**
 * Builds the prompt data without executing the API call.
 * Useful for "Copy Prompt" functionality or preparing the request.
 */
export const buildPromptData = (config: AIConfig): PromptData => {
  const langInstruction = config.language === 'pt'
    ? "All content (Project Name, Description, Features, States, Entities, Descriptions) MUST be in Portuguese (Brazil)."
    : "All content must be in English.";

  // Category-specific instructions
  let categoryInstruction = "";
  let scientificNameInstruction = "";

  if (config.category === 'FAUNA') {
    categoryInstruction = "Focus on zoological characteristics. Use appropriate terminology for animals (morphology, behavior, habitat).";
    scientificNameInstruction = "For biological entities, ALWAYS provide: 1) the scientific binomial name (e.g., 'Panthera leo', 'Ara macao'), and 2) the taxonomic family (e.g., 'Felidae', 'Psittacidae'). Both are REQUIRED for accurate classification.";
  } else if (config.category === 'OTHER') {
    categoryInstruction = "Focus on the specific domain of the topic. Use appropriate terminology for the subject matter.";
    scientificNameInstruction = "For non-biological entities, provide the most precise and standard name available. If applicable, provide the creator/author/origin in the description. Scientific name field can be used for original title or subtitle if applicable, or left empty.";
  } else {
    // FLORA (Default)
    categoryInstruction = "Focus on botanical characteristics. Use appropriate terminology for plants.";
    scientificNameInstruction = "For biological entities, ALWAYS provide: 1) the scientific binomial name (e.g., 'Panthera leo', 'Quercus robur'), and 2) the taxonomic family (e.g., 'Felidae', 'Fabaceae'). Both are REQUIRED for accurate classification.";
  }

  let featureImageInstruction = config.includeFeatureImages
    ? "For each feature, provide a valid, DIRECT public URL to an image file illustrating the trait if available."
    : "Leave `imageUrl` empty for features.";

  // NOTE: Links are now generated programmatically from scientific names, so we tell the AI to leave them empty
  const linkInstruction = "Leave the 'links' array empty (links will be generated automatically from scientific names).";

  // 1. IMPORT MODE LOGIC
  if (config.importedFile) {

    // Feature Focus Logic for Import
    let filterInstruction = "Extract ALL distinctive features found in the text.";
    if (config.featureFocus === 'vegetative') {
      filterInstruction = "STRICTLY EXTRACT ONLY VEGETATIVE features (leaves, bark, stem, roots, growth habit). IGNORE reproductive features (flowers, fruits, seeds).";
    } else if (config.featureFocus === 'reproductive') {
      filterInstruction = "STRICTLY EXTRACT ONLY REPRODUCTIVE features (flowers, fruits, seeds, inflorescence). IGNORE vegetative features.";
    }

    // Detail Level Logic for Import
    let detailInstruction = "Maintain the descriptions as close to the original text as possible (Balanced).";
    if (config.detailLevel === 1) {
      detailInstruction = "SIMPLIFY the descriptions. Use shorter, easier sentences. Remove excessive jargon.";
    } else if (config.detailLevel === 3) {
      detailInstruction = "MAXIMIZE DETAIL. Keep all scientific terms, measurements, and nuances found in the text.";
    }

    // Required features instruction for import mode
    const requiredFeaturesImport = config.requiredFeatures && config.requiredFeatures.length > 0
      ? `7. **REQUIRED FEATURES**: Prioritize extracting the following features if present in the document: ${config.requiredFeatures.join(', ')}. If the document doesn't mention them explicitly, still try to infer reasonable states for these features based on context.`
      : '';

    const importSystemInstruction = `
      You are an expert biologist and data analyst.
      Your task is to analyze the provided document (PDF, Text, or Image) and extract a structured Matrix Identification Key.
      
      **Goal**: Extract entities and features to build a matrix.
      
      **CRITICAL INSTRUCTIONS**: 
      1. You must extract **EVERY SINGLE** species/entity found in the text. DO NOT truncate the list.
      2. **FILTER**: ${filterInstruction}
      3. **DETAIL**: ${detailInstruction}
      4. **SCIENTIFIC NAMES**: ${scientificNameInstruction}
      5. **MEDIA**: 
         - Feature Images: ${featureImageInstruction}
         - External Links: ${linkInstruction}
      6. ${langInstruction}
      ${requiredFeaturesImport}
      
      **Format**: Return valid JSON.
      **IMPORTANT**: Do not include markdown code fences (\`\`\`json ... \`\`\`). Return raw JSON only. Ensure all keys and string values are properly escaped.
    `;

    const importPrompt = `
      Analyze the attached file. Extract a comprehensive biological identification key.
      
      - Project Name: Derive from document title.
      - Description: Summary of content.
      - Entities: Extract ALL entities found. Include scientific names for accurate image lookup.
      - Features: Extract distinctive traits based on the focus setting.
      - Matrix: Map traits to entities.
      
      If analyzing a Dichotomous Key, flatten the logic: assign all traits accumulated along the path to the species.
    `;

    const parts = [
      {
        inlineData: {
          mimeType: config.importedFile.mimeType,
          data: config.importedFile.data
        }
      },
      { text: importPrompt }
    ];

    return {
      systemInstruction: importSystemInstruction,
      prompt: importPrompt,
      parts: parts,
      schema: importSchema
    };
  }

  // 2. GENERATION MODE LOGIC (Standard)
  let focusInstruction = "";
  if (config.featureFocus === 'reproductive') {
    focusInstruction = "Focus primarily on reproductive features (e.g., flowers, fruits, seeds, cones, spores, inflorescence).";
  } else if (config.featureFocus === 'vegetative') {
    focusInstruction = "Focus primarily on vegetative features (e.g., leaves, bark, stem, roots, growth habit, phyllo taxis).";
  } else if (config.featureFocus === 'general') {
    focusInstruction = "Use a balanced mix of vegetative and reproductive features.";
  } else {
    // Custom feature focus
    focusInstruction = `Focus features on the description provided: ${config.featureFocus}. Extract characteristics and states based on this specific focus.`;
  }

  // Detail Level Logic
  let detailInstruction = "";
  if (config.detailLevel === 1) {
    detailInstruction = "AUDIENCE: Children or General Public. Use simple, common language. Short descriptions. Avoid complex jargon.";
  } else if (config.detailLevel === 3) {
    detailInstruction = "AUDIENCE: Experts/Scientists. Use precise botanical/zoological terminology. Comprehensive descriptions. High detail.";
  } else {
    detailInstruction = "AUDIENCE: Students/Enthusiasts. Balanced use of scientific terms with clear explanations.";
  }

  const systemInstruction = `
    You are an expert taxonomist and biologist. 
    Your task is to create an interactive identification key (matrix key) based strictly on the user's constraints.
    
    Constraints:
    1.  **Language**: ${langInstruction}
    2.  **Category**: ${categoryInstruction}
    3.  **Topic**: The general subject.
    4.  **Geography**: Restrict entities to this region/biome.
    5.  **Taxonomy**: Restrict to this Family/Genus/Order if specified.
    6.  **Quantity**: Generate exactly or close to the requested number of entities and features.
    7.  **Focus**: ${focusInstruction}
    8.  **Detail Level**: ${detailInstruction}
    9.  **SCIENTIFIC NAMES**: ${scientificNameInstruction}
    10. **MEDIA**: 
        - Feature Images: ${featureImageInstruction}
        - External Links: ${linkInstruction}
    ${config.requiredFeatures && config.requiredFeatures.length > 0 ? `11. **REQUIRED FEATURES**: You MUST include ALL of the following features in the key: ${config.requiredFeatures.join(', ')}. These are mandatory and must be among the features generated.` : ''}
    ${config.requiredSpecies && config.requiredSpecies.length > 0 ? `12. **REQUIRED SPECIES**: You MUST include ALL of the following species in the key: ${config.requiredSpecies.slice(0, 10).join(', ')}${config.requiredSpecies.length > 10 ? ` (and ${config.requiredSpecies.length - 10} more)` : ''}. These species are MANDATORY. For species with incomplete data, include them anyway and fill what you can.` : ''}

    Output Requirements:
    1.  List of distinctive features. Each feature must have 2+ states.
    2.  List of entities with their scientific binomial names.
    3.  Matrix: Assign correct states.
    4.  **Scientific Accuracy**: Ensure traits are factual.

    The response must be a structured JSON object.
    **IMPORTANT**: Do not include markdown code fences (\`\`\`json ... \`\`\`). Return raw JSON only. Ensure all keys and string values are properly escaped.
  `;

  // Build required features instruction for prompt
  const requiredFeaturesPrompt = config.requiredFeatures && config.requiredFeatures.length > 0
    ? `\n    MANDATORY FEATURES: The following features MUST be included in the key:\n    ${config.requiredFeatures.map((f, i) => `${i + 1}. ${f}`).join('\n    ')}\n`
    : '';

  // Build required species instruction for prompt
  const requiredSpeciesPrompt = config.requiredSpecies && config.requiredSpecies.length > 0
    ? `\n    MANDATORY SPECIES: The following species MUST be included in the key. Include them even if feature data is incomplete - fill in what you can:\n    ${config.requiredSpecies.map((s, i) => `${i + 1}. ${s}`).join('\n    ')}\n`
    : '';

  // Build geographic context from new fields
  const buildGeographicContext = () => {
    const parts: string[] = [];
    if (config.scope === 'global') {
      parts.push('Global scope');
    } else if (config.scope === 'national') {
      parts.push('Brazil (national)');
    } else if (config.scope === 'regional') {
      parts.push('Regional focus');
    }
    if (config.biome) parts.push(`Biome: ${config.biome}`);
    if (config.stateUF) parts.push(`State/UF: ${config.stateUF}`);
    if (config.geography) parts.push(`Region: ${config.geography}`);
    return parts.length > 0 ? parts.join(', ') : 'Global';
  };

  // Build taxonomic context from new fields
  const buildTaxonomicContext = () => {
    const parts: string[] = [];
    if (config.taxonomyFamily) parts.push(`Family: ${config.taxonomyFamily}`);
    if (config.taxonomyGenus) parts.push(`Genus: ${config.taxonomyGenus}`);
    if (config.taxonomy) parts.push(config.taxonomy); // Legacy field for compatibility
    return parts.length > 0 ? parts.join(', ') : 'General';
  };

  const prompt = `
    Create an identification key for: "${config.topic}".
    
    Constraints:
    - Language: ${config.language === 'pt' ? 'Portuguese' : 'English'}
    - Geographic Scope: ${buildGeographicContext()}
    - Taxonomic Context: ${buildTaxonomicContext()}
    - Target Number of Entities: ${config.count}${config.requiredSpecies && config.requiredSpecies.length > 0 ? ` (minimum - must include all required species plus additional if needed)` : ''}
    - Target Number of Features: ${config.featureCount}
    - Feature Focus: ${config.featureFocus}
    - Complexity Level: ${config.detailLevel}/3
    ${requiredFeaturesPrompt}${requiredSpeciesPrompt}
    IMPORTANT: For each entity, you MUST provide the scientificName field with the correct binomial nomenclature (e.g., "Panthera leo" for Lion).
    ${config.taxonomyFamily ? `All entities MUST belong to the family ${config.taxonomyFamily}.` : ''}
    ${config.taxonomyGenus ? `All entities MUST belong to the genus ${config.taxonomyGenus}.` : ''}
    ${config.biome ? `All entities MUST occur in the ${config.biome} biome.` : ''}
    ${config.stateUF ? `All entities MUST occur in ${config.stateUF}, Brazil.` : ''}
    ${config.scope === 'national' ? 'All entities MUST occur in Brazil. Use Flora do Brasil 2020 as reference for valid names.' : ''}
    ${config.requiredSpecies && config.requiredSpecies.length > 0 ? `\nCRITICAL: You MUST include ALL species from the MANDATORY SPECIES list above. For any species where you lack complete information, still include them and fill in what characteristics you can determine. These species are non-negotiable.` : ''}

    Ensure the features allow for effective separation of these entities.
  `;

  return {
    systemInstruction,
    prompt,
    schema: generationSchema,
    parts: undefined // Standard generation uses prompt string as content
  };
};

export const generateKeyFromTopic = async (
  config: AIConfig,
  apiKey: string,
  onPromptGenerated?: (fullPrompt: string) => void,
  onImageProgress?: (current: number, total: number, entityName: string) => void
): Promise<Project> => {
  if (!apiKey) throw new Error("API Key is missing");

  const ai = new GoogleGenAI({ apiKey: apiKey });

  // Build the prompt using the extracted logic
  const { systemInstruction, prompt, parts, schema } = buildPromptData(config);

  // Notify callback for clipboard (reconstructing the full context)
  if (onPromptGenerated) {
    onPromptGenerated(`SYSTEM:\n${systemInstruction}\n\nUSER PROMPT:\n${prompt}`);
  }

  // Determine content payload (Simple text or Parts array for files)
  const contents = parts ? parts : prompt;

  // Generate the key structure (without reliable images yet)
  const project = await callGemini(ai, config.model, contents, systemInstruction, schema, config.language, config.includeLinks);

  // CRITICAL: Ensure ALL required species are included in the project
  // Even if the AI didn't include them, we add them with empty traits
  if (config.requiredSpecies && config.requiredSpecies.length > 0) {
    const existingNames = new Set(
      project.entities.map(e => e.name.toLowerCase().trim())
    );

    // Also check by scientific name similarity
    const existingScientificNames = new Set(
      project.entities.map(e => {
        const sciName = (e as any).scientificName || extractScientificName(e.name) || '';
        return sciName.toLowerCase().trim();
      })
    );

    for (const requiredSpecies of config.requiredSpecies) {
      const speciesLower = requiredSpecies.toLowerCase().trim();
      const speciesBinomial = extractBinomial(requiredSpecies).toLowerCase().trim();

      // Check if species already exists (by name or scientific name)
      const alreadyExists = existingNames.has(speciesLower) ||
        existingNames.has(speciesBinomial) ||
        existingScientificNames.has(speciesLower) ||
        existingScientificNames.has(speciesBinomial) ||
        // Also check partial matches for cases like "Inga edulis Mart." vs "Inga edulis"
        Array.from(existingNames).some(n => n.includes(speciesBinomial) || speciesBinomial.includes(n)) ||
        Array.from(existingScientificNames).some(n => n.includes(speciesBinomial) || speciesBinomial.includes(n));

      if (!alreadyExists) {
        // Add missing required species with placeholder data
        const cleanName = extractBinomial(requiredSpecies) || requiredSpecies;
        const newEntity: Entity = {
          id: generateId(),
          name: cleanName,
          description: config.language === 'pt'
            ? `Espécie incluída da lista obrigatória. Dados a serem preenchidos.`
            : `Species included from required list. Data to be filled.`,
          imageUrl: getPlaceholderImage(cleanName),
          links: config.includeLinks ? generateEntityLinks(cleanName, '', config.language) : [],
          traits: {} // Empty traits - user can fill in later
        };

        // Add scientificName for image fetching
        (newEntity as any).scientificName = cleanName;

        project.entities.push(newEntity);

        // Update existing sets
        existingNames.add(cleanName.toLowerCase().trim());
        existingScientificNames.add(cleanName.toLowerCase().trim());
      }
    }
  }

  // Now fetch real images from iNaturalist/Wikipedia APIs
  // Limit to first 100 entities to avoid very long wait times
  const MAX_IMAGE_FETCH = 100;
  if (config.includeSpeciesImages && project.entities.length > 0) {
    const entitiesToFetch = project.entities.slice(0, MAX_IMAGE_FETCH).map(e => {
      // Prioritize explicit scientificName from Entity
      const sciName = (e as any).scientificName || extractScientificName(e.name) || undefined;
      return {
        name: e.name,
        scientificName: sciName
      };
    });

    const imageMap = await fetchImagesForEntities(
      entitiesToFetch,
      config.language,
      onImageProgress,
      config.category
    );

    // Update entities with fetched images, remove temporary scientificName field
    project.entities = project.entities.map((entity, index) => {
      const { scientificName, ...cleanEntity } = entity as any;
      // Only update image for entities we fetched (first MAX_IMAGE_FETCH)
      const imageUrl = index < MAX_IMAGE_FETCH
        ? (imageMap.get(entity.name) || getPlaceholderImage(entity.name))
        : getPlaceholderImage(entity.name);
      return {
        ...cleanEntity,
        imageUrl
      };
    });
  }

  // Fetch images for Feature States (Morphology/Characteristics)
  // This is a new step to enrich the key with visual definitions
  if (config.includeFeatureImages && project.features.length > 0) {
    const totalStates = project.features.reduce((acc, f) => acc + f.states.length, 0);
    let stateProgress = 0;

    // We process features in parallel, but states sequentially to be kind to APIs
    const featurePromises = project.features.map(async (feature) => {
      // For each feature, process its states
      const statePromises = feature.states.map(async (state) => {
        // Skip if already has image (e.g. from template)
        if (state.imageUrl && state.imageUrl.length > 5) return state;

        // Fetch image for this state
        const imageUrl = await fetchFeatureStateImage(
          feature.name,
          state.label,
          config.language,
          config.category
        );

        // Update progress
        stateProgress++;
        if (onImageProgress) {
          // We repurpose the progress callback to show state updates
          // Use a distinct prefix like "[Feature] " to differentiate from entities
          onImageProgress(stateProgress, totalStates, `[Trait] ${state.label}`);
        }

        return {
          ...state,
          imageUrl: imageUrl || ""
        };
      });

      const updatedStates = await Promise.all(statePromises);
      return {
        ...feature,
        states: updatedStates
      };
    });

    project.features = await Promise.all(featurePromises);
  }

  return project;
};

export const generateKeyFromCustomPrompt = async (
  customPrompt: string,
  apiKey: string,
  model: string = "gemini-2.0-flash",
  language: string = 'pt'
): Promise<Project> => {
  if (!apiKey) throw new Error("API Key is missing");
  const ai = new GoogleGenAI({ apiKey: apiKey });

  // Use minimal system instruction as the user provides the full context
  const systemInstruction = `You are an expert biologist. Return ONLY valid JSON matching the schema. Do not include markdown code fences.`;

  return await callGemini(ai, model, customPrompt, systemInstruction, generationSchema, language, true);
};

/**
 * Specialized function for REFINE/EXPAND/CLEAN operations.
 * Uses a schema that preserves entity IDs and trait format to avoid complex remapping.
 * Returns partial data (only modified entities) to reduce token usage and processing time.
 */
export const refineExistingProject = async (
  prompt: string,
  existingProject: Project,
  apiKey: string,
  model: string = "gemini-2.0-flash",
  language: string = 'pt',
  mode: 'fillGaps' | 'refine' | 'expand' | 'clean' = 'refine'
): Promise<Project> => {
  if (!apiKey) throw new Error("API Key is missing");
  const ai = new GoogleGenAI({ apiKey: apiKey });

  const featureById = new Map(existingProject.features.map(f => [f.id, f]));
  const entityById = new Map(existingProject.entities.map(e => [e.id, e]));

  const schema = mode === 'fillGaps' ? fillGapsSchema : (mode === 'clean' ? generationSchema : refineSchema);
  let systemInstruction = "";

  if (mode === 'fillGaps') {
    systemInstruction = 'You are an expert taxonomist. Fill missing trait data. Use exact IDs.';
  } else if (mode === 'clean') {
    systemInstruction = 'You are an expert taxonomist. Clean and optimize the key. Preserve all IDs.';
  } else {
    systemInstruction = 'You are an expert taxonomist. Improve key while preserving all IDs.';
  }

  if (mode === 'fillGaps') {
    const entitiesWithGaps = existingProject.entities.filter(entity => {
      return existingProject.features.some(feature => {
        const traits = entity.traits[feature.id];
        return !traits || traits.length === 0;
      });
    });

    if (entitiesWithGaps.length === 0) return existingProject;

    const BATCH_SIZE = 10;
    const filledTraitsMap = new Map();
    const featuresContext = JSON.stringify(existingProject.features.map(f => ({
      id: f.id, name: f.name, states: f.states.map(s => ({ id: s.id, label: s.label }))
    })));

    for (let i = 0; i < entitiesWithGaps.length; i += BATCH_SIZE) {
      const batch = entitiesWithGaps.slice(i, i + BATCH_SIZE);
      const batchPrompt = 'TASK: Fill traits. FEATURES: ' + featuresContext + ' ENTITIES: ' + JSON.stringify(batch.map(e => ({ id: e.id, name: e.name })));

      try {
        const response = await callGeminiRaw(ai, model, batchPrompt, systemInstruction, fillGapsSchema);
        const data = repairTruncatedJson(response) || {};
        const filledEntities = data.filledEntities || [];
        for (const item of filledEntities) {
          const traits = {};
          if (Array.isArray(item.filledTraits)) {
            item.filledTraits.forEach(t => { if (t.featureId && t.stateIds) traits[t.featureId] = t.stateIds; });
          }
          if (Object.keys(traits).length > 0) filledTraitsMap.set(item.entityId, traits);
        }
        await new Promise(r => setTimeout(r, 2000));
      } catch (err) {
        console.error(`Error in fillGaps batch ${i / BATCH_SIZE}:`, err);
        continue;
      }
    }

    const mergedEntities = existingProject.entities.map(entity => {
      const newTraits = filledTraitsMap.get(entity.id);
      if (!newTraits) return entity;
      const validatedTraits = { ...entity.traits };
      for (const [fid, sids] of Object.entries(newTraits)) {
        const f = featureById.get(fid);
        if (f) {
          const vids = f.states.map(s => s.id);
          validatedTraits[fid] = [...new Set([...(validatedTraits[fid] || []), ...(sids as string[]).filter(sid => vids.includes(sid))])];
        }
      }
      return { ...entity, traits: validatedTraits };
    });
    return { ...existingProject, entities: mergedEntities };
  }

  if (mode === 'refine' && existingProject.entities.length > 10) {
    const BATCH_SIZE = 10;
    const entities = existingProject.entities;
    let processedEntities = [];
    let allNewFeatures = [];
    const seenIds = new Set();

    try {
      const firstBatch = entities.slice(0, BATCH_SIZE);
      const response = await callGeminiRaw(ai, model, prompt + ' DATA: ' + JSON.stringify({ features: existingProject.features, entities: firstBatch }), systemInstruction, refineSchema);
      const data = repairTruncatedJson(response) || {};
      if (data.features) allNewFeatures = data.features;
      if (data.entities) {
        data.entities.forEach(item => {
          const ex = entityById.get(item.id);
          if (ex && !seenIds.has(item.id)) {
            seenIds.add(item.id);
            let traits = {}; try { traits = typeof item.traitsMap === 'string' ? repairTruncatedJson(item.traitsMap) : (item.traitsMap || {}); } catch (e) { }
            processedEntities.push({ ...ex, description: (item.description && item.description.length > 15) ? item.description : ex.description, traits: Object.keys(traits).length > 0 ? traits : ex.traits });
          }
        });
      }
    } catch (err) {
      console.error("Error in first refine batch:", err);
    }

    const allFeatures = [...existingProject.features, ...allNewFeatures];
    const featuresRef = JSON.stringify(allFeatures.map(f => ({ id: f.id, name: f.name, states: f.states.map(s => ({ id: s.id, label: s.label })) })));

    for (let i = BATCH_SIZE; i < entities.length; i += BATCH_SIZE) {
      const batch = entities.slice(i, i + BATCH_SIZE);
      const batchPrompt = 'TASK: Refine. FEATURES: ' + featuresRef + ' ENTITIES: ' + JSON.stringify(batch);
      try {
        const response = await callGeminiRaw(ai, model, batchPrompt, systemInstruction, refineSchema);
        const data = repairTruncatedJson(response) || {};
        if (data.entities) {
          data.entities.forEach(item => {
            const ex = entityById.get(item.id);
            if (ex && !seenIds.has(item.id)) {
              seenIds.add(item.id);
              let traits = {}; try { traits = typeof item.traitsMap === 'string' ? repairTruncatedJson(item.traitsMap) : (item.traitsMap || {}); } catch (e) { }
              processedEntities.push({ ...ex, description: (item.description && item.description.length > 15) ? item.description : ex.description, traits: Object.keys(traits).length > 0 ? traits : ex.traits });
            }
          });
        }
        await new Promise(r => setTimeout(r, 2000));
      } catch (err) {
        console.error(`Error in refine batch ${i / BATCH_SIZE}:`, err);
        continue;
      }
    }

    existingProject.entities.forEach(e => { if (!seenIds.has(e.id)) processedEntities.push(e); });
    return { ...existingProject, features: allFeatures, entities: processedEntities };
  }

  try {
    const projectContext = JSON.stringify({ features: existingProject.features, entities: existingProject.entities });
    if (mode === 'clean') return await callGemini(ai, model, prompt + ' DATA: ' + projectContext, systemInstruction, schema, language, true);
    const response = await callGeminiRaw(ai, model, prompt + ' DATA: ' + projectContext, systemInstruction, schema);
    const data = repairTruncatedJson(response) || {};
    const processedEntities = [];
    const seenIds = new Set();
    if (data.entities) {
      data.entities.forEach(item => {
        const ex = entityById.get(item.id);
        if (seenIds.has(item.id)) return;
        seenIds.add(item.id);
        let traits = {}; try { traits = typeof item.traitsMap === 'string' ? repairTruncatedJson(item.traitsMap) : (item.traitsMap || {}); } catch (e) { }
        processedEntities.push({
          id: item.id || ex?.id || generateId(),
          name: item.name || ex?.name || 'Unknown',
          scientificName: item.scientificName || ex?.scientificName,
          family: item.family || ex?.family,
          description: (item.description && item.description.length > 15) ? item.description : (ex?.description || ''),
          imageUrl: ex?.imageUrl || '',
          links: ex?.links || [],
          traits: Object.keys(traits).length > 0 ? traits : (ex?.traits || {})
        });
      });
    }
    if (mode === 'expand' || mode === 'refine') existingProject.entities.forEach(e => { if (!seenIds.has(e.id)) processedEntities.push(e); });
    let finalFeatures = existingProject.features;
    if (mode === 'refine' && data.features) {
      data.features.forEach(nf => {
        if (!nf.id || !nf.name || !nf.states) return;
        if (!existingProject.features.some(f => f.name.toLowerCase() === nf.name.toLowerCase())) {
          finalFeatures = [...finalFeatures, { id: nf.id, name: nf.name, states: nf.states }];
        }
      });
    }
    return { ...existingProject, entities: processedEntities, features: finalFeatures };
  } catch (error) { throw error; }
};

/**
 * Specialized function for VALIDATE operations.
 * Validates and corrects taxonomy without regenerating the entire project structure.
 * This is much faster and more reliable than full regeneration.
 */
export const validateTaxonomy = async (
  prompt: string,
  existingProject: Project,
  apiKey: string,
  model: string = "gemini-2.0-flash",
  language: string = 'pt',
  options: {
    referenceSource?: string;
    customSource?: string;
    category?: 'FLORA' | 'FAUNA' | 'OTHER';
  } = {}
): Promise<Project> => {
  if (!apiKey) throw new Error("API Key is missing");
  const ai = new GoogleGenAI({ apiKey: apiKey });

  // Serialize only necessary entity data to save tokens
  const entityContext = JSON.stringify(
    existingProject.entities.map(e => ({
      id: e.id,
      name: e.name,
      scientificName: e.scientificName || extractScientificName(e.name),
      family: e.family
    })),
    null,
    2
  );

  const referenceSourceLabel = options.referenceSource === 'custom'
    ? (options.customSource || 'Reputable Scientific Sources')
    : (options.referenceSource === 'floradobrasil' ? 'Flora do Brasil 2020'
      : options.referenceSource === 'wfo' ? 'World Flora Online (WFO)'
        : options.referenceSource === 'gtfb' ? 'Catálogo Taxonômico da Fauna do Brasil' // Typo fix: CTFB
          : options.referenceSource === 'catalogueoflife' ? 'Catalogue of Life'
            : options.referenceSource === 'powo' ? 'Plants of the World Online (POWO)'
              : options.referenceSource === 'gbif' ? 'GBIF Backbone Taxonomy'
                : 'Reputable Scientific Databases');

  const fullPrompt = `${prompt}\n\nENTITIES TO VALIDATE:\n${entityContext}`;

  const systemInstruction = `You are an expert taxonomic validator. 
Your task is to validate the scientific names and taxonomy of the provided entities using ${referenceSourceLabel} as the PRIMARY reference.
1. Check each entity against ${referenceSourceLabel}.
2. Correct spelling errors in scientific names (Genus species).
3. Standardize family names according to ${referenceSourceLabel}.
4. Mark 'isValid' as false ONLY if the entity should be REMOVED according to the specific removal criteria in the prompt (e.g. wrong genus/family/geography).
5. If the entity is valid but name was corrected, set 'isValid' to true and provide the new 'scientificName'.
6. CRITICAL: Preserve the exact 'id' for each entity.
7. Output must be a JSON object with 'validatedEntities' array.`;

  try {
    const response = await callGeminiRaw(ai, model, fullPrompt, systemInstruction, validationResultSchema);

    // Parse response safely
    let data: any = {};
    try {
      data = repairTruncatedJson(response) || {};
    } catch (parseError) {
      console.error('[validateTaxonomy] Failed to parse AI response:', parseError);
      return existingProject;
    }

    if (!data.validatedEntities || !Array.isArray(data.validatedEntities)) {
      console.warn('[validateTaxonomy] Invalid response format, returning original project');
      return existingProject;
    }

    // Create map of validation results
    const validationMap = new Map<string, any>(data.validatedEntities.map((e: any) => [e.id, e]));

    // Filter and update entities
    const newEntities: Entity[] = [];
    let modifiedCount = 0;
    let removedCount = 0;

    for (const entity of existingProject.entities) {
      const result = validationMap.get(entity.id);

      if (!result) {
        // If not returned in validation, keep it (assume valid or missed)
        newEntities.push(entity);
        continue;
      }

      if (result.isValid) {
        // Update entity with corrected data if it changed
        const newSciName = result.scientificName || entity.scientificName || extractScientificName(entity.name) || undefined;
        const newFamily = result.family || entity.family || undefined;

        // Check if anything changed
        if (newSciName !== entity.scientificName || newFamily !== entity.family) {
          modifiedCount++;
        }

        newEntities.push({
          ...entity,
          scientificName: newSciName,
          family: newFamily
        });
      } else {
        removedCount++;
        console.log(`[validateTaxonomy] Removing entity ${entity.name} (${entity.id}): ${result.correctionNote}`);
      }
    }

    console.log(`[validateTaxonomy] Completed. Modified: ${modifiedCount}, Removed: ${removedCount}`);

    return {
      ...existingProject,
      entities: newEntities
    };

  } catch (error) {
    console.error('[validateTaxonomy] Error:', error);
    throw error;
  }
};

// Raw Gemini call that returns text (used by refineExistingProject)
async function callGeminiRaw(
  ai: GoogleGenAI,
  modelName: string,
  contents: string,
  systemInstruction: string,
  responseSchema: Schema
): Promise<string> {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const fallbackModels = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];

  const generate = async (model: string, retryCount: number = 0): Promise<string> => {
    const maxRetries = 5; // Increased from 3 to 5 for better stability
    try {
      const response = await ai.models.generateContent({
        model: model.trim(),
        contents: contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema,
          maxOutputTokens: 65536,
        }
      });
      return response.text || "{}";
    } catch (error: any) {
      const errorMessage = error.message || '';
      const errorCode = error.status || 0;

      // Handle 503/429 with retry
      if ((errorCode === 503 || errorCode === 429 || errorMessage.includes('overloaded')) && retryCount < maxRetries) {
        // Aggressive exponential backoff for batch processing
        const waitTime = Math.pow(2, retryCount) * 5000; // 5s, 10s, 20s, 40s, 80s
        console.warn(`Retrying ${model} in ${waitTime / 1000}s (attempt ${retryCount + 1})`);
        await delay(waitTime);
        return generate(model, retryCount + 1);
      }

      // Try fallback model if max retries exceeded or for other errors
      const currentIndex = fallbackModels.indexOf(model);
      if (currentIndex < fallbackModels.length - 1) {
        console.warn(`Falling back from ${model} to ${fallbackModels[currentIndex + 1]}`);
        return generate(fallbackModels[currentIndex + 1], 0);
      } else if (!fallbackModels.includes(model)) {
        // If current model is not in fallback list (e.g. user defined "gemini-2.5-flash"), try first fallback
        console.warn(`Model ${model} failed, falling back to standard ${fallbackModels[0]}`);
        return generate(fallbackModels[0], 0);
      }

      throw error;
    }
  };

  return generate(modelName || "gemini-2.0-flash");
}

// Unified Gemini Call function with Schema support
async function callGemini(
  ai: GoogleGenAI,
  modelName: string,
  contents: any,
  systemInstruction: string,
  responseSchema: Schema,
  language: string = 'en',
  includeLinks: boolean = true
): Promise<Project> {

  // Helper to wait with exponential backoff
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const generateContentWithFallback = async (currentModel: string, retryCount: number = 0): Promise<any> => {
    const maxRetries = 3;
    const fallbackModels = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];

    try {
      return await ai.models.generateContent({
        model: currentModel.trim(),
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          // CRITICAL FIX: Increase max output tokens to allow large JSON responses (e.g. 133 species)
          maxOutputTokens: 65536,
        }
      });
    } catch (error: any) {
      const errorMessage = error.message || '';
      const errorCode = error.status || (errorMessage.includes('503') ? 503 : errorMessage.includes('429') ? 429 : 0);

      // Handle model not found - try fallback models
      if (errorMessage.includes("404") || errorMessage.includes("NOT_FOUND")) {
        const currentIndex = fallbackModels.indexOf(currentModel);
        const nextModel = fallbackModels[currentIndex + 1] || fallbackModels[0];
        if (nextModel !== currentModel) {
          console.warn(`Model ${currentModel} not found, falling back to ${nextModel}`);
          return await generateContentWithFallback(nextModel, 0);
        }
      }

      // Handle overloaded (503) or rate limit (429) - retry with exponential backoff
      if ((errorCode === 503 || errorCode === 429 || errorMessage.includes('overloaded') || errorMessage.includes('UNAVAILABLE')) && retryCount < maxRetries) {
        const waitTime = Math.pow(2, retryCount) * 5000; // 5s, 10s, 20s
        console.warn(`Model ${currentModel} is overloaded (attempt ${retryCount + 1}/${maxRetries}). Retrying in ${waitTime / 1000}s...`);
        await delay(waitTime);
        return await generateContentWithFallback(currentModel, retryCount + 1);
      }

      // If max retries exceeded for current model, try next fallback model
      if ((errorCode === 503 || errorCode === 429 || errorMessage.includes('overloaded')) && retryCount >= maxRetries) {
        const currentIndex = fallbackModels.indexOf(currentModel);
        const nextModel = fallbackModels[currentIndex + 1];
        if (nextModel) {
          console.warn(`Model ${currentModel} still overloaded after ${maxRetries} retries. Trying ${nextModel}...`);
          return await generateContentWithFallback(nextModel, 0);
        }
      }

      throw error;
    }
  };

  try {
    const modelToUse = modelName || "gemini-2.0-flash";
    const response = await generateContentWithFallback(modelToUse);
    // Use repair function instead of straight JSON.parse
    const data = repairTruncatedJson(response.text || "{}");

    if (!data.projectName) throw new Error("Invalid AI response: missing projectName");
    if (!data.features || !Array.isArray(data.features)) {
      console.error("[parseAIResponse] Invalid features:", data.features);
      throw new Error("Invalid AI response: features must be an array");
    }
    if (!data.entities || !Array.isArray(data.entities)) {
      console.error("[parseAIResponse] Invalid entities:", data.entities);
      throw new Error("Invalid AI response: entities must be an array");
    }

    // Transform AI response to internal data model with IDs
    const features: Feature[] = data.features.map((f: any) => {
      if (!f || typeof f !== 'object') {
        console.warn("[parseAIResponse] Skipping invalid feature:", f);
        return null;
      }
      // Handle states in different formats:
      // 1. Array of strings: ["State1", "State2"]
      // 2. Array of objects: [{id: "xxx", label: "State1"}] (from REFINE)
      const states = (f.states || []).map((s: any) => {
        if (typeof s === 'string') {
          return { id: generateId(), label: s };
        } else if (typeof s === 'object' && s !== null) {
          // Preserve existing ID if present, otherwise generate new one
          return { id: s.id || generateId(), label: s.label || s };
        }
        return { id: generateId(), label: String(s) };
      });

      return {
        id: f.id || generateId(), // Preserve existing ID if present
        name: f.name || "Unnamed Feature",
        imageUrl: f.imageUrl || "",
        states
      };
    }).filter((f: Feature | null): f is Feature => f !== null);

    const entities: Entity[] = data.entities.map((e: any) => {
      if (!e || typeof e !== 'object') {
        console.warn("[parseAIResponse] Skipping invalid entity:", e);
        return null;
      }
      const entityTraits: Record<string, string[]> = {};

      // Handle different trait formats:
      // 1. Array of objects: [{featureName, stateValue}] or strings "Feature:State"
      // 2. Object/Record: {featureId: [stateIds]} (from REFINE operations)
      // 3. undefined/null - just use empty traits

      if (e.traits === undefined || e.traits === null) {
        // No traits provided, leave entityTraits empty
        console.log(`[parseAIResponse] Entity "${e.name}" has no traits defined`);
      } else if (Array.isArray(e.traits)) {
        // Format 1: Array of traits
        e.traits.forEach((t: any) => {
          let fName: string = "";
          let sValue: string = "";

          // Hybrid Parsing: Support both Object {featureName, stateValue} and String "Feature:State"
          if (typeof t === 'string') {
            const splitIndex = t.indexOf(':');
            if (splitIndex > -1) {
              fName = t.substring(0, splitIndex).trim();
              sValue = t.substring(splitIndex + 1).trim();
            }
          } else if (typeof t === 'object' && t !== null) {
            fName = t.featureName;
            sValue = t.stateValue;
          }

          if (fName && sValue) {
            // Fuzzy match feature name to be robust against minor AI hallucinations (case/trim)
            const feature = features.find(f => f.name.toLowerCase() === fName.toLowerCase());
            if (feature) {
              // Fuzzy match state
              const state = feature.states.find(s => s.label.toLowerCase() === sValue.toLowerCase());
              if (state) {
                if (!entityTraits[feature.id]) entityTraits[feature.id] = [];
                entityTraits[feature.id].push(state.id);
              }
            }
          }
        });
      } else if (typeof e.traits === 'object' && e.traits !== null) {
        // Format 2: Object/Record {featureId: [stateIds]} - pass through directly
        // This format comes from REFINE operations where IDs are preserved
        for (const [featureId, stateIds] of Object.entries(e.traits)) {
          if (Array.isArray(stateIds)) {
            entityTraits[featureId] = stateIds as string[];
          }
        }
      }
      // If e.traits is undefined or null, entityTraits remains empty {}

      // scientificName and family for taxonomy/image fetching
      let scientificName = e.scientificName || extractScientificName(e.name);
      // Sanity check: if scientificName is exactly the same as name, and name is simple (one word), it's likely a common name copied over
      // But if it allows binomials, we keep it. 
      // Better to rely on extractBinomial or just leave it if it came from AI.
      // Crucial: DO NOT fallback to e.name if e.name is a common name.

      const family = e.family || '';

      // Placeholder URL - will be replaced by real API fetched images in generateKeyFromTopic
      const placeholderUrl = getPlaceholderImage(e.name);

      // Generate reliable links programmatically instead of using AI-generated URLs
      const entityLinks = includeLinks
        ? generateEntityLinks(scientificName, family, language)
        : [];

      return {
        id: e.id || generateId(), // Preserve existing ID if present (from REFINE)
        name: e.name || "Unnamed Entity",
        scientificName: scientificName, // Store for image fetching and taxonomy
        family: family, // Taxonomic family
        description: e.description || "",
        imageUrl: e.imageUrl || placeholderUrl, // Preserve existing image if present
        links: e.links || entityLinks, // Preserve existing links if present
        traits: entityTraits
      };
    }).filter((e: Entity | null): e is Entity => e !== null);

    return {
      id: data.id || generateId(), // Preserve project ID if present
      name: data.projectName || data.name,
      description: data.projectDescription || data.description,
      features,
      entities
    };

  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
}

/**
 * Convert dichotomous key from spreadsheet to NOZESia matrix format
 */
export const convertDichotomousKey = async (
  apiKey: string,
  spreadsheetData: any[][],
  fileName: string,
  language: 'pt' | 'en' = 'pt'
): Promise<Project> => {
  if (!apiKey) {
    throw new Error(language === 'pt' ? 'Chave de API necessária' : 'API key required');
  }

  const ai = new GoogleGenAI({ apiKey });

  // Convert spreadsheet to text format for analysis
  const keyText = spreadsheetData.map(row => row.join(' | ')).join('\n');

  const prompt = language === 'pt'
    ? `Você é um especialista em taxonomia e chaves de identificação. Analise esta chave dicotômica e extraia:

1. TODAS as entidades (famílias, gêneros ou espécies) mencionadas
2. TODAS as características diagnósticas mencionadas
3. Mapeie quais características cada entidade possui

CHAVE DICOTÔMICA:
${keyText}

Retorne um JSON no seguinte formato:
{
  "projectName": "Nome da chave",
  "projectDescription": "Descrição breve",
  "features": [
    {
      "name": "Nome da característica",
      "states": ["Estado 1", "Estado 2"]
    }
  ],
  "entities": [
    {
      "name": "Nome da entidade",
      "scientificName": "Nome científico se aplicável",
      "family": "Família se aplicável",
      "description": "Breve descrição",
      "characteristics": {
        "Nome da característica": ["Estados que a entidade possui"]
      }
    }
  ]
}

IMPORTANTE:
- Extraia TODAS as características mencionadas (presença de látex, tipo de folha, nervação, etc)
- Para cada entidade, liste TODAS as características que a levam à identificação
- Se uma característica não foi mencionada para uma entidade, não inclua
- Agrupe características similares (ex: "látex branco" e "látex amarelo" = característica "Cor do látex")
- Use os nomes científicos completos quando mencionados
- Crie estados binários quando apropriado (ex: "presente"/"ausente")`
    : `You are an expert in taxonomy and identification keys. Analyze this dichotomous key and extract:

1. ALL entities (families, genera, or species) mentioned
2. ALL diagnostic characteristics mentioned
3. Map which characteristics each entity possesses

DICHOTOMOUS KEY:
${keyText}

Return a JSON in the following format:
{
  "projectName": "Key name",
  "projectDescription": "Brief description",
  "features": [
    {
      "name": "Feature name",
      "states": ["State 1", "State 2"]
    }
  ],
  "entities": [
    {
      "name": "Entity name",
      "scientificName": "Scientific name if applicable",
      "family": "Family if applicable",
      "description": "Brief description",
      "characteristics": {
        "Feature name": ["States that the entity has"]
      }
    }
  ]
}

IMPORTANT:
- Extract ALL mentioned characteristics (presence of latex, leaf type, venation, etc)
- For each entity, list ALL characteristics that lead to identification
- If a characteristic wasn't mentioned for an entity, don't include it
- Group similar characteristics (e.g., "white latex" and "yellow latex" = "Latex color" feature)
- Use complete scientific names when mentioned
- Create binary states when appropriate (e.g., "present"/"absent")`;

  try {
    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        projectName: { type: Type.STRING },
        projectDescription: { type: Type.STRING },
        features: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              states: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            }
          }
        },
        entities: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              scientificName: { type: Type.STRING },
              family: { type: Type.STRING },
              description: { type: Type.STRING },
              characteristics: {
                type: Type.OBJECT
              }
            }
          }
        }
      },
      required: ['projectName', 'features', 'entities']
    };

    const project = await callGemini(ai, "gemini-2.0-flash-exp", prompt, "", schema, language, false);

    // Return the project directly since callGemini already structures it correctly
    return project;

  } catch (error) {
    console.error("Dichotomous key conversion error:", error);
    throw error;
  }
}