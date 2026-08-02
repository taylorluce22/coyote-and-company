/*
 photo-triage.swift — sort a bulk photo dump into launch-ready buckets.

 Usage:   swift tools/photo-triage.swift ~/Desktop/photo-dump
 Output:  inside the given folder (originals are COPIED, never moved):
   01-carousel-picks/   best ~14 overall (sharp, well-lit, face preferred)
   02-soul-id/          best ~24 face-forward shots for Higgsfield Soul ID
   03-usable-extras/    everything else that passes the quality bar
   04-rejects/          too small / unreadable / duplicates / screenshots
   report.csv           every photo with its scores and bucket + reason

 Why Swift: macOS ships everything this needs — Vision (face detection),
 ImageIO (HEIC/JPEG/PNG decode + EXIF) — so it runs on a stock Mac with
 Xcode CLT and no pip/brew installs. Metrics are computed on a 128px
 grayscale thumbnail with plain pixel loops: deterministic and cheap.
*/

import Foundation
import ImageIO
import Vision
import CoreGraphics
import CryptoKit

let EXTS = ["jpg", "jpeg", "png", "heic", "heif", "tif", "tiff", "webp"]
let MIN_SHORT_EDGE = 900        // below this IG quality suffers
let CAROUSEL_N = 14
let SOUL_N = 24

struct Shot {
    let url: URL
    var width = 0, height = 0
    var sharpness = 0.0          // laplacian variance on 128px gray
    var brightness = 0.0         // mean luma 0..1
    var faceCount = 0
    var faceFrac = 0.0           // largest face bbox area fraction 0..1
    var hash = ""
    var bucket = ""
    var reason = ""
    var score = 0.0
    var soulScore = 0.0
}

func fail(_ msg: String) -> Never { FileHandle.standardError.write((msg + "\n").data(using: .utf8)!); exit(1) }

guard CommandLine.arguments.count >= 2 else { fail("usage: swift photo-triage.swift <folder>") }
let root = URL(fileURLWithPath: (CommandLine.arguments[1] as NSString).expandingTildeInPath, isDirectory: true)
let fm = FileManager.default
guard fm.fileExists(atPath: root.path) else { fail("no such folder: \(root.path)") }

// collect candidate files (top level only — output subfolders must not recurse)
let items = (try? fm.contentsOfDirectory(at: root, includingPropertiesForKeys: nil)) ?? []
let files = items.filter { EXTS.contains($0.pathExtension.lowercased()) }
guard !files.isEmpty else { fail("no image files found in \(root.path)") }
print("scanning \(files.count) images…")

func grayThumb(_ src: CGImageSource) -> (pix: [UInt8], w: Int, h: Int)? {
    let opts: [CFString: Any] = [
        kCGImageSourceCreateThumbnailFromImageAlways: true,
        kCGImageSourceThumbnailMaxPixelSize: 128,
        kCGImageSourceCreateThumbnailWithTransform: true,
    ]
    guard let img = CGImageSourceCreateThumbnailAtIndex(src, 0, opts as CFDictionary) else { return nil }
    let w = img.width, h = img.height
    var pix = [UInt8](repeating: 0, count: w * h)
    guard let ctx = CGContext(data: &pix, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w,
                              space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue)
    else { return nil }
    ctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
    return (pix, w, h)
}

var shots: [Shot] = []
var seenHashes = Set<String>()

for url in files {
    var s = Shot(url: url)
    guard let data = try? Data(contentsOf: url) else { s.bucket = "04-rejects"; s.reason = "unreadable"; shots.append(s); continue }
    s.hash = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    if seenHashes.contains(s.hash) { s.bucket = "04-rejects"; s.reason = "duplicate"; shots.append(s); continue }
    seenHashes.insert(s.hash)

    guard let src = CGImageSourceCreateWithData(data as CFData, nil),
          let props = CGImageSourceCopyPropertiesAtIndex(src, 0, nil) as? [CFString: Any],
          let w = props[kCGImagePropertyPixelWidth] as? Int,
          let h = props[kCGImagePropertyPixelHeight] as? Int
    else { s.bucket = "04-rejects"; s.reason = "undecodable"; shots.append(s); continue }
    s.width = w; s.height = h

    if url.lastPathComponent.lowercased().contains("screenshot") || url.lastPathComponent.lowercased().contains("screen shot") {
        s.bucket = "04-rejects"; s.reason = "screenshot"; shots.append(s); continue
    }
    if min(w, h) < MIN_SHORT_EDGE {
        s.bucket = "04-rejects"; s.reason = "too small (\(w)x\(h))"; shots.append(s); continue
    }

    if let t = grayThumb(src) {
        var sum = 0.0
        for p in t.pix { sum += Double(p) }
        s.brightness = sum / Double(t.pix.count) / 255.0
        // laplacian variance
        var lsum = 0.0, lsq = 0.0
        var n = 0
        for y in 1..<(t.h - 1) {
            for x in 1..<(t.w - 1) {
                let i = y * t.w + x
                let lap = 4.0 * Double(t.pix[i]) - Double(t.pix[i - 1]) - Double(t.pix[i + 1])
                        - Double(t.pix[i - t.w]) - Double(t.pix[i + t.w])
                lsum += lap; lsq += lap * lap; n += 1
            }
        }
        let mean = lsum / Double(n)
        s.sharpness = lsq / Double(n) - mean * mean
    }

    // face detection on the full-size image (Vision handles scaling internally)
    let req = VNDetectFaceRectanglesRequest()
    let handler = VNImageRequestHandler(url: url, options: [:])
    if (try? handler.perform([req])) != nil, let faces = req.results, !faces.isEmpty {
        s.faceCount = faces.count
        s.faceFrac = faces.map { Double($0.boundingBox.width * $0.boundingBox.height) }.max() ?? 0
    }
    shots.append(s)
}

// normalize sharpness against this batch (relative quality beats absolute thresholds)
let live = shots.filter { $0.bucket.isEmpty }
let sharpVals = live.map { $0.sharpness }.sorted()
func pct(_ v: Double) -> Double {
    guard !sharpVals.isEmpty else { return 0 }
    let below = sharpVals.filter { $0 < v }.count
    return Double(below) / Double(sharpVals.count)
}

for i in shots.indices where shots[i].bucket.isEmpty {
    let s = shots[i]
    let sharpN = pct(s.sharpness)
    let brightOk = (s.brightness > 0.14 && s.brightness < 0.92) ? 1.0 : 0.0
    let faceBonus = s.faceCount > 0 ? Swift.min(1.0, 0.4 + s.faceFrac * 12.0) : 0.0
    let resBonus = Swift.min(1.0, Double(Swift.min(s.width, s.height)) / 2000.0)
    shots[i].score = 0.45 * sharpN + 0.25 * faceBonus + 0.15 * brightOk + 0.15 * resBonus
    // soul: face is mandatory and dominant; needs a clearly visible face
    shots[i].soulScore = (s.faceCount >= 1 && s.faceFrac >= 0.015 && brightOk > 0)
        ? (0.6 * Swift.min(1.0, s.faceFrac * 14.0) + 0.4 * sharpN) : 0.0
}

// assign buckets: soul first (face-mandatory), then carousel, then extras
let soulPicks = shots.indices.filter { shots[$0].bucket.isEmpty && shots[$0].soulScore > 0 }
    .sorted { shots[$0].soulScore > shots[$1].soulScore }.prefix(SOUL_N)
for i in soulPicks { shots[i].bucket = "02-soul-id"; shots[i].reason = String(format: "soul %.2f face %.1f%%", shots[i].soulScore, shots[i].faceFrac * 100) }

let carouselPicks = shots.indices.filter { shots[$0].bucket.isEmpty || shots[$0].bucket == "02-soul-id" }
    .sorted { shots[$0].score > shots[$1].score }.prefix(CAROUSEL_N)
for i in carouselPicks where shots[i].bucket.isEmpty { shots[i].bucket = "01-carousel-picks"; shots[i].reason = String(format: "score %.2f", shots[i].score) }
// a shot can be both a soul and carousel candidate — copy such soul picks into carousel too
let dualPicks = carouselPicks.filter { shots[$0].bucket == "02-soul-id" }

for i in shots.indices where shots[i].bucket.isEmpty { shots[i].bucket = "03-usable-extras"; shots[i].reason = String(format: "score %.2f", shots[i].score) }

// write outputs (copy, never move)
for dir in ["01-carousel-picks", "02-soul-id", "03-usable-extras", "04-rejects"] {
    try? fm.createDirectory(at: root.appendingPathComponent(dir), withIntermediateDirectories: true)
}
for s in shots {
    let dest = root.appendingPathComponent(s.bucket).appendingPathComponent(s.url.lastPathComponent)
    if !fm.fileExists(atPath: dest.path) { try? fm.copyItem(at: s.url, to: dest) }
}
for i in dualPicks {
    let dest = root.appendingPathComponent("01-carousel-picks").appendingPathComponent(shots[i].url.lastPathComponent)
    if !fm.fileExists(atPath: dest.path) { try? fm.copyItem(at: shots[i].url, to: dest) }
}

var csv = "file,bucket,reason,width,height,sharpness,brightness,faces,largest_face_pct,score,soul_score\n"
for s in shots.sorted(by: { $0.score > $1.score }) {
    csv += "\"\(s.url.lastPathComponent)\",\(s.bucket),\"\(s.reason)\",\(s.width),\(s.height),\(String(format: "%.1f", s.sharpness)),\(String(format: "%.2f", s.brightness)),\(s.faceCount),\(String(format: "%.1f", s.faceFrac * 100)),\(String(format: "%.2f", s.score)),\(String(format: "%.2f", s.soulScore))\n"
}
try? csv.write(to: root.appendingPathComponent("report.csv"), atomically: true, encoding: .utf8)

let counts = Dictionary(grouping: shots, by: { $0.bucket }).mapValues { $0.count }
print("done.")
for k in ["01-carousel-picks", "02-soul-id", "03-usable-extras", "04-rejects"] {
    print("  \(k): \(counts[k] ?? 0)\(k == "01-carousel-picks" && !dualPicks.isEmpty ? " (+\(dualPicks.count) shared with soul-id)" : "")")
}
print("  report.csv written. Originals untouched.")
