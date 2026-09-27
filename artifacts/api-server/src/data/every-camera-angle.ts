// The gallery image is an angle reference, not Image 1. Users supply their own
// source portrait when using this prompt in Studio.
const everyCameraAnglePrompt = `Purpose: camera-angle catalogue — one person, one location, 9 named camera angles arranged by distance across the sheet. Output: 4:5 vertical, 1152x1440. quality: high.

Image 1: source portrait. This is a photograph of one specific real person. Every one of the 9 panels is a photograph of THIS SAME PERSON in THIS SAME LOCATION on the same day. If a panel could be a different person, that panel is wrong.

Deliverable: a single sheet divided into a 3-column by 3-row grid of 9 equal portrait-orientation panels, separated by even gutters of flat matte black card, with the same black card as a border around the whole sheet. Rounded corners on every panel.

RHYTHM RULE, ABSOLUTE — every panel is defined by four numbers: the height of the camera, its tilt in degrees, its focal length, and the fraction of the frame height the subject occupies. Hold all four exactly as written. No two neighbouring panels, horizontally or vertically, may share the same subject size, and no two panels anywhere on the sheet resolve to the same camera position.

ZONE RULE, ABSOLUTE — the sheet is laid out by distance. The top-centre panel is the macro extreme close-up. The top row, the centre and the whole right column hold the close and medium angles, where the face or the upper body carries the frame. The bottom-left corner and the panels touching it hold the distant angles, where the figure is small inside the architecture. No distant angle appears in the top row or the right column; no close angle appears in the bottom-left corner.

Identity rule, absolute: the same person in all 9 panels. Hold from Image 1: the exact skull proportions, the width of the face at the cheekbones against the width at the jaw, eye shape and the spacing between the pupils, the angle and width of the nose bridge, the outline of the nostrils, lip shape and mouth width, the exact outline and set of the ears, the brow line, the hairline, the exact beard or stubble edge if present, skin tone and undertone, and every mole, freckle, birthmark and scar in its true position. In the distant panels the face is small but still unmistakably this person; in the profile and rear panels the identity is carried by the nose bridge, the chin outline, the ear and the hairline; in the elevated panels by the hairline, the parting, the crown and the outline of the shoulders; in the macro panels by the exact iris pattern, pore texture, lip outline and the true position of every mark on the skin.

Pose rule: one standing pose held through all 9 panels — upright, weight even on both feet, arms folded across the chest with the left forearm over the right, chin level. The body does not change between panels. Only the camera and the framing change, and the gaze changes only where a panel below says so.

Wardrobe rule: the same clothing in all 9 panels, replicated exactly from Image 1 — same garment, same colour, same fit. Every accessory from Image 1 preserved in every panel: glasses, watch, rings, chains, piercings. Nothing added, nothing removed.

Location rule, absolute: one single interior, the same building in all 9 panels — a large empty hall in board-formed exposed concrete, polished concrete floor, one tall window wall along one side, a concrete stair with a steel handrail set back across the space. Each panel shows the part of THIS building that would actually fall behind or around the subject from that camera position. Never a different room, never a studio backdrop, never a neutral void.

Lighting rule, absolute: one soft daylight source, the window wall, fixed in the building and not attached to the camera. Its direction relative to the subject is identical in all 9 panels, so the light on the face changes honestly as the camera moves. Same exposure, same white balance and same colour grade across the sheet. Never relight a panel to flatter the face.

Panels, reading left to right, top row first:

1. CLOSE UP — camera at 1.65 m, level, 85mm, directly in front. Head and shoulders, the face filling most of the frame height, background thrown gently out of focus. Eyes directly into the lens.

2. EXTREME CLOSE UP, EYES — camera at 1.65 m, level, 100mm macro at 0.3 m. The frame holds only the brow, both eyes and the bridge of the nose, cropped above the brow and below the cheekbones, lash detail, iris pattern and skin pores fully resolved. Eyes directly into the lens.

3. EYE LEVEL — camera at 1.65 m, level at 0 degrees, 50mm, directly in front. Framed from the waist up, the subject filling roughly three quarters of the frame height, undistorted and neutral, the room reading naturally behind. Eyes directly into the lens.

4. CRANE — camera 5 m up and to one side, tilted down 40 degrees, 35mm. The subject occupies roughly two fifths of the frame height, seen from gallery height, the floor a wide plane below and the stair and the window wall laid out around the figure. Gaze level, straight ahead, not up.

5. HIGH ANGLE — camera at 2.4 m, tilted down 35 degrees, 35mm, directly in front. Framed from the knees up, the subject filling roughly two thirds of the frame height, the floor occupying the lower half. Gaze lifted to the lens.

6. LOW ANGLE — camera at 0.9 m, tilted up 30 degrees, 28mm, directly in front. The subject fills roughly nine tenths of the frame height, the ceiling edge just entering the top of the frame. Gaze level, past the camera.

7. DRONE VIEW — camera 9 m up and well back, tilted down 55 degrees, 24mm. The subject occupies roughly one fifth of the frame height, small against the architecture, the stair and the full span of the hall dominating. Gaze straight ahead, not up at the camera.

8. WIDE FULL — camera at 1.65 m, level, 24mm, well back. The whole figure small and off-centre, occupying roughly one third of the frame height, the full height of the hall and the stair visible around them. Gaze level, straight ahead.

9. WORM'S EYE — camera on the floor at 0.15 m, tilted up 70 degrees, 18mm. The subject fills the full frame height, towering and foreshortened with strong wide-angle convergence, the concrete ceiling slab filling the upper third. Gaze straight ahead, well over the lens.

Labels: a white rounded rectangular plate sitting centred on the bottom edge of each panel, overlapping the panel and the gutter, carrying black lowercase monospace type. EXACT TEXT, reading in row order, left to right: "/closeup:" "/extremecloseupeyes:" "/eyelevel:" "/crane:" "/highangle:" "/lowangle:" "/droneview:" "/widefull:" "/wormseye:". Render this text verbatim, exactly as written, including the leading slash and the trailing colon. No extra characters. No duplicate text.

Rendering: photorealistic editorial photography, natural skin rendering with visible pores and real surface texture, individual hair strands, true fabric weave, correct optical behaviour for each stated focal length — visible wide-angle stretch at 16mm, 18mm and 24mm, natural compression at 85mm and 100mm, true macro magnification at the stated macro distances. No retouching, no skin smoothing, no face slimming, no beautification, no symmetry correction.

Constraints: the same person in all panels — no generic faces, no family resemblance instead of identity, no substituted person; no change to skull width, eye spacing, nose bridge angle, mouth width, ear outline or chin outline in any panel; no change of pose, no unfolding of the arms, no shift of weight; no change of clothing, no missing accessories; no change of building, no studio backdrop, no empty background; no relighting to favour the face; no two panels resolving to the same camera position or the same subject size; "/crane:" "/droneview:" "/widefull:" are the only panels where the figure is smaller than half the frame height, and they sit in the bottom-left zone only; the eyes meet the lens only in /closeup:, /extremecloseupeyes:, /eyelevel:, and /highangle:.`;

export default everyCameraAnglePrompt;