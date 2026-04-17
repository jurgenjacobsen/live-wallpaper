package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
)

type githubLatestRelease struct {
	TagName    string `json:"tag_name"`
	HTMLURL    string `json:"html_url"`
	Prerelease bool   `json:"prerelease"`
}

type semVersion struct {
	major      int
	minor      int
	patch      int
	prerelease string
}

func checkForGithubReleaseUpdate(ctx context.Context, currentVersion string) (latestVersion string, releaseURL string, updateAvailable bool, err error) {
	apiURL := fmt.Sprintf("https://api.github.com/repos/%s/%s/releases/latest", githubRepoOwner, githubRepoName)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return "", "", false, fmt.Errorf("create update request: %w", err)
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", fmt.Sprintf("%s/%s", appDisplayName, currentVersion))

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", "", false, fmt.Errorf("request latest release: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", "", false, fmt.Errorf("request latest release: unexpected status %s", resp.Status)
	}

	var release githubLatestRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return "", "", false, fmt.Errorf("decode latest release: %w", err)
	}

	if release.Prerelease {
		return "", "", false, nil
	}
	if strings.TrimSpace(release.TagName) == "" || strings.TrimSpace(release.HTMLURL) == "" {
		return "", "", false, fmt.Errorf("latest release response missing tag_name or html_url")
	}

	currentSem, err := parseSemVersion(currentVersion)
	if err != nil {
		return "", "", false, fmt.Errorf("parse current version %q: %w", currentVersion, err)
	}
	latestSem, err := parseSemVersion(release.TagName)
	if err != nil {
		return "", "", false, fmt.Errorf("parse latest version %q: %w", release.TagName, err)
	}

	if compareSemVersion(latestSem, currentSem) <= 0 {
		return release.TagName, release.HTMLURL, false, nil
	}

	return release.TagName, release.HTMLURL, true, nil
}

func parseSemVersion(raw string) (semVersion, error) {
	v := strings.TrimSpace(raw)
	v = strings.TrimPrefix(v, "v")
	v = strings.TrimPrefix(v, "V")
	if v == "" {
		return semVersion{}, fmt.Errorf("empty version")
	}

	buildParts := strings.SplitN(v, "+", 2)
	coreAndPre := buildParts[0]

	pre := ""
	parts := strings.SplitN(coreAndPre, "-", 2)
	core := parts[0]
	if len(parts) == 2 {
		pre = parts[1]
	}

	numParts := strings.Split(core, ".")
	if len(numParts) > 3 {
		return semVersion{}, fmt.Errorf("too many numeric version parts")
	}

	nums := [3]int{0, 0, 0}
	for i := 0; i < len(numParts); i++ {
		n, err := strconv.Atoi(numParts[i])
		if err != nil {
			return semVersion{}, fmt.Errorf("invalid numeric part %q", numParts[i])
		}
		nums[i] = n
	}

	return semVersion{major: nums[0], minor: nums[1], patch: nums[2], prerelease: pre}, nil
}

func compareSemVersion(a semVersion, b semVersion) int {
	if a.major != b.major {
		if a.major > b.major {
			return 1
		}
		return -1
	}
	if a.minor != b.minor {
		if a.minor > b.minor {
			return 1
		}
		return -1
	}
	if a.patch != b.patch {
		if a.patch > b.patch {
			return 1
		}
		return -1
	}

	if a.prerelease == "" && b.prerelease != "" {
		return 1
	}
	if a.prerelease != "" && b.prerelease == "" {
		return -1
	}
	if a.prerelease > b.prerelease {
		return 1
	}
	if a.prerelease < b.prerelease {
		return -1
	}
	return 0
}
