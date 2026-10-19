# iGEM software submission checklist

Use this checklist after the files in this repository have been pushed to the CUHKSZ team's official iGEM GitLab repository.

## Required repository checks

- [ ] The canonical repository URL is under `https://gitlab.igem.org/` and belongs to the official team account.
- [ ] The default branch contains `README.md`, `LICENSE`, `NOTICE`, `package.json`, and `package-lock.json`.
- [ ] `npm ci` succeeds from a fresh clone.
- [ ] `npm run verify` succeeds from a fresh clone.
- [ ] The GitLab `verify` pipeline is green.
- [ ] `samples/demo-history.csv` reproduces the analysis workflow described in the README.
- [ ] `DEVICE_INTERFACE.md` matches the final firmware UUIDs and Wi-Fi message format.
- [ ] Repository visibility matches the competition's submission requirements.
- [ ] The full Git repository is below 50 MB (`du -sh .git` after cloning).
- [ ] Any later large datasets or media are archived on Zenodo and linked from the README.
- [ ] The wiki Software page links to the official iGEM GitLab repository, not only to the GitHub mirror.

## Recommended first push

For an empty official GitLab repository:

```bash
git clone https://github.com/Reign419/Reign419.github.io.git plantsos-software
cd plantsos-software
git remote rename origin github
git remote add igem <official-iGEM-GitLab-repository-url>
npm ci
npm run verify
git push -u igem main
```

If the official iGEM GitLab repository already contains work from teammates, do not force-push. Clone that repository, copy or merge the PlantSOS files on a branch, review the changes, and merge normally.

## Release evidence

Record the following in the wiki or release notes:

- the final GitLab commit SHA;
- the date and output of `npm run verify`;
- the browser/device versions used for BLE and Wi-Fi acceptance testing;
- the firmware version used for the recorded demonstration;
- the Zenodo DOI for any external dataset, if applicable.
