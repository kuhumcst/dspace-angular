import { TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { TransferState } from '@angular/platform-browser';
import { NGX_TRANSLATE_STATE, NgxTranslateState } from './ngx-translate-state';
import { hasValue } from '../app/shared/empty.util';
import { catchError, map } from 'rxjs/operators';
import { forkJoin, of as observableOf, Observable } from 'rxjs';
import { environment } from '../environments/environment';

/**
 * A TranslateLoader for ngx-translate to retrieve i18n messages from the TransferState, or download
 * them if they're not available there.
 *
 * Loads two files per language and merges them — the base catalogue and the theme overlay — so
 * CLARIN-DK overrides stay isolated in the theme without modifying the upstream base file.
 */
export class TranslateBrowserLoader implements TranslateLoader {
  constructor(
    protected transferState: TransferState,
    protected http: HttpClient,
    protected prefix?: string,
    protected suffix?: string
  ) {
  }

  getTranslation(lang: string): Observable<any> {
    const state = this.transferState.get<NgxTranslateState>(NGX_TRANSLATE_STATE, {});
    const messages = state[lang];
    if (hasValue(messages)) {
      // Server already merged base + theme overlay and stored the result in TransferState.
      return observableOf(messages);
    }

    const translationHash: string = environment.production ? `.${(process.env.languageHashes as any)[lang + '.json5']}` : '';
    const base$ = this.http.get(`${this.prefix}${lang}${translationHash}${this.suffix}`, { responseType: 'text' }).pipe(
      map((json: any) => JSON.parse(json))
    );
    // Theme overlay — converted from JSON5 at build time by webpack CopyPlugin.
    // catchError handles the case where no overlay exists for this language.
    const overlay$ = this.http.get(`assets/custom/i18n/${lang}.json`, { responseType: 'text' }).pipe(
      map((json: any) => JSON.parse(json)),
      catchError(() => observableOf({}))
    );

    return forkJoin([base$, overlay$]).pipe(
      map(([base, overlay]) => Object.assign({}, base, overlay))
    );
  }
}
