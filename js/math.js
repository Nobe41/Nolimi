// ==========================================
// PROFIL BOUTEILLE — MODÈLE 6 SECTIONS
// Sections reliées par courbes (pied, épaule, bas col).
// Toutes les grandeurs en mm.
// ==========================================

function getSectionParam(id, def) {
    var el = document.getElementById(id);
    if (!el) return def;
    var v = parseFloat(el.value);
    return isNaN(v) ? def : v;
}

function generateBottleProfile() {
    // —— Bouteille conçue avec les 6 sections : chaque section fournit hauteur / largeur / profondeur au profil. ——

    // Section 1 — Pied : largeur = diamètre au sol
    var R_base = getSectionParam('s1-L', 75) / 2;
    var r_pied = getSectionParam('r12-rho', 5);

    // Section 2 — Corps : hauteur, largeur (bas), section 3 largeur (haut du corps)
    var h_corps = getSectionParam('s2-h', 200);
    var R_corps0 = getSectionParam('s2-L', 75) / 2;
    var R_corps1 = getSectionParam('s3-L', 75) / 2;

    // Rattachement 2 : courbe épaule (corps → col)
    var rho_epaule = getSectionParam('r23-rho', 40);

    // Section 3 — Épaule : profondeur = rayon bas du col (jonction)
    // Section 4 — Col : hauteur, largeur (bas col), section 5 largeur (haut du col)
    var R_col0 = getSectionParam('s4-L', 30) / 2;
    var h_col = getSectionParam('s4-h', 70);
    var R_col1 = getSectionParam('s5-L', 30) / 2;

    // Rattachement 4 : courbe bas col (col → bague)
    var rho_col = getSectionParam('r45-rho', 20);

    // Section 5 — Bas col : profondeur = rayon bague (jonction)
    // Section 6 — Bague : hauteur, largeur = diamètre bague
    var R_bague = getSectionParam('s6-L', 29.6) / 2;
    var h_bague = getSectionParam('s6-h', 15);

    // —— Positions Y (ordonnées) des jonctions ——
    // Corps : ligne de (R_corps0, y_pied_end) à (R_corps1, y_corps_end). Pied : arc de (R_base, 0) à (R_corps0, y_pied_end).
    var theta_corps = Math.atan2(h_corps, R_corps1 - R_corps0);
    var L_corps = Math.sqrt(h_corps * h_corps + (R_corps1 - R_corps0) * (R_corps1 - R_corps0));
    var B_pied = R_base - R_corps0 + (r_pied * h_corps / L_corps);
    var A_pied = r_pied * (R_corps1 - R_corps0) / L_corps;
    var disc = r_pied * r_pied - B_pied * B_pied;
    var y_pied_end = disc >= 0 ? (-A_pied + Math.sqrt(disc)) : (r_pied * Math.tan(theta_corps / 2) * Math.sin(theta_corps));
    var cx_pied = R_corps0 - r_pied * h_corps / L_corps;
    var cy_pied = y_pied_end + A_pied;

    var y_corps_start = y_pied_end;
    var y_corps_end = y_corps_start + h_corps;

    // Courbe épaule (S3) : arc tangent corps → col. Centre (cx1, cy1), rayon rho_epaule.
    var theta_corps_norm = theta_corps + Math.PI / 2;
    var cx1 = R_corps1 + rho_epaule * Math.cos(theta_corps_norm);
    var cy1 = y_corps_end + rho_epaule * Math.sin(theta_corps_norm);
    var T_epaule_x = R_corps1;
    var T_epaule_y = y_corps_end;

    // Col (S4) : ligne de (R_col0, y_col_start) à (R_col1, y_col_end). Début col = fin courbe épaule.
    var y_col_start = cy1 - rho_epaule * Math.sin(theta_corps_norm - Math.PI);
    var y_col_end = y_col_start + h_col;
    var theta_col = Math.atan2(h_col, R_col1 - R_col0);
    var theta_col_norm = theta_col - Math.PI / 2;
    var cx2 = R_col0 + rho_col * Math.cos(theta_col_norm);
    var cy2 = y_col_start + rho_col * Math.sin(theta_col_norm);
    var T_col_x = R_col0;
    var T_col_y = y_col_start;

    // Points de tangence courbe épaule (T1) et courbe col (T2)
    var dx_c = cx2 - cx1;
    var dy_c = cy2 - cy1;
    var dist_c = Math.sqrt(dx_c * dx_c + dy_c * dy_c);
    var r_sum = rho_epaule + rho_col;
    var bitangent_valid = dist_c >= r_sum;
    var T1x = cx1, T1y = cy1 + rho_epaule;
    var T2x = cx2, T2y = cy2 - rho_col;
    if (bitangent_valid) {
        var angle_centres = Math.atan2(dy_c, dx_c);
        var angle_offset = Math.acos(r_sum / dist_c);
        var theta1 = angle_centres - angle_offset;
        T1x = cx1 + rho_epaule * Math.cos(theta1);
        T1y = cy1 + rho_epaule * Math.sin(theta1);
        var theta2 = angle_centres - angle_offset + Math.PI;
        T2x = cx2 + rho_col * Math.cos(theta2);
        T2y = cy2 + rho_col * Math.sin(theta2);
    }

    // Début bague (S6)
    var y_bague_start = y_col_end;
    var y_bague_end = y_bague_start + h_bague;

    // Échantillonnage Y
    var keyY = [0, y_pied_end, y_corps_end, T1y, T2y, T_col_y, y_col_start, y_col_end, y_bague_start, y_bague_end];
    keyY.sort(function (a, b) { return a - b; });
    var finalY = [];
    for (var i = 0; i < keyY.length - 1; i++) {
        var yS = keyY[i];
        var yE = keyY[i + 1];
        var dist = yE - yS;
        if (dist < 0.01) continue;
        var steps = Math.max(2, Math.ceil(dist * 2));
        for (var j = 0; j < steps; j++) {
            finalY.push(yS + (dist * j / steps));
        }
    }
    finalY.push(y_bague_end);

    var points = [];
    for (var k = 0; k < finalY.length; k++) {
        var y = finalY[k];
        var r;
        if (y < y_pied_end) {
            r = cx_pied + Math.sqrt(Math.max(0, r_pied * r_pied - (y - cy_pied) * (y - cy_pied)));
        } else if (y <= y_corps_end) {
            var t = (y - y_corps_start) / (y_corps_end - y_corps_start);
            r = R_corps0 + t * (R_corps1 - R_corps0);
        } else if (bitangent_valid && y <= T1y) {
            r = cx1 + Math.sqrt(Math.max(0, rho_epaule * rho_epaule - (y - cy1) * (y - cy1)));
        } else if (bitangent_valid && y <= T2y) {
            var t_ = (y - T1y) / (T2y - T1y);
            r = T1x + t_ * (T2x - T1x);
        } else if (bitangent_valid && y <= T_col_y) {
            r = cx2 - Math.sqrt(Math.max(0, rho_col * rho_col - (y - cy2) * (y - cy2)));
        } else if (!bitangent_valid && y <= T_col_y) {
            var t_ = (y - y_corps_end) / (T_col_y - y_corps_end);
            r = T_epaule_x + t_ * (T_col_x - T_epaule_x);
        } else if (y < y_col_end - 0.001) {
            var t = (y - y_col_start) / (y_col_end - y_col_start);
            r = R_col0 + t * (R_col1 - R_col0);
        } else if (y <= y_bague_start + 0.001) {
            r = R_col1;
        } else {
            r = R_bague;
        }
        points.push(new THREE.Vector2(Math.max(0.1, r), y));
    }
    return points;
}

function getRadiusAtHeight(targetY, profilPoints) {
    if (targetY <= profilPoints[0].y) return profilPoints[0].x;
    if (targetY >= profilPoints[profilPoints.length - 1].y) return profilPoints[profilPoints.length - 1].x;
    for (var i = 0; i < profilPoints.length - 1; i++) {
        if (targetY >= profilPoints[i].y && targetY <= profilPoints[i + 1].y) {
            var t = (targetY - profilPoints[i].y) / (profilPoints[i + 1].y - profilPoints[i].y);
            return profilPoints[i].x + t * (profilPoints[i + 1].x - profilPoints[i].x);
        }
    }
    return 30;
}
