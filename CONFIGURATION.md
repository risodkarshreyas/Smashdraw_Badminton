# Tournament configuration

Edit `public/tournament-config.json` before building or deploying the site.

```json
{
  "protectTopFour": true
}
```

- `true`: participants in positions 1, 2, 3 and 4 cannot be paired with one another.
- `false`: every participant can be paired with every other participant.

Participant positions are determined by the order in the text box or the uploaded file. Uploaded files should contain one name per row in the first column. Supported formats are TXT, CSV, XLS and XLSX.
