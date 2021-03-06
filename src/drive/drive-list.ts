import constants = require('../.constants');
import driveAuth = require('./drive-auth');
import { google } from 'googleapis';
import utils = require('./drive-utils');
import dlUtils = require('../download_tools/utils');

/**
 * Searches for a given file on Google Drive. Only search the subfolders and files
 * of the folder that files are uploaded into. This function only performs performs
 * prefix matching, though it tries some common variations.
 * @param {string} fileName The name of the file to search for
 * @param {function} callback A function to call with an error, or a human-readable message
 */
export function listFiles(fileName: string, callback: (err: string, message: string) => void): void {
  // Uncommenting the below line will prevent users from asking to list all files
  // if (fileName === '' || fileName ==='*' || fileName === '%') return;
  let parent_dir_id: string | string[];
  parent_dir_id = constants.GDRIVE_PARENT_DIR_ID;
  if (fileName !== '*' && constants.OTHER_GDRIVE_DIR_IDS.length > 0) {
    constants.OTHER_GDRIVE_DIR_IDS.push(constants.GDRIVE_PARENT_DIR_ID);
    parent_dir_id = constants.OTHER_GDRIVE_DIR_IDS;
  }
  driveAuth.call((err, auth) => {
    if (err) {
      callback(err, null);
      return;
    }
    const drive = google.drive({ version: 'v3', auth });

    drive.files.list({
      // @ts-ignore Unknown property error
      fields: 'files(id, name, mimeType, size)',
      q: generateSearchQuery(fileName, parent_dir_id),
      orderBy: 'modifiedTime desc',
      pageSize: 20,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    },
      (listErr: Error, res: any) => {
        if (listErr) {
          callback(listErr.message, null);
        } else {
          res = res['data']['files'];
          getMultipleFileLinks(res);
          callback(null, generateFilesListMessage(res, fileName));
        }
      });
  });
}

function generateSearchQuery(fileName: string, parent: string | string[]): string {
  if (Array.isArray(parent)) {
    var q: string;
    q = '(';
    parent.forEach((element, key) => {
      if (parent.length === key + 1) {
        q += '\'' + element + '\' in parents)';
      } else {
        q += '\'' + element + '\' in parents or ';
      }
    });
    q += ' and (';
  } else {
    var q = '\'' + parent + '\' in parents and (';
  }
  if (fileName.indexOf(' ') > -1) {
    for (var i = 0; i < 4; i++) {
      q += 'name contains \'' + fileName + '\' ';
      switch (i) {
        case 0:
          fileName = fileName.replace(/ /g, '.');
          q += 'or ';
          break;
        case 1:
          fileName = fileName.replace(/\./g, '-');
          q += 'or ';
          break;
        case 2:
          fileName = fileName.replace(/-/g, '_');
          q += 'or ';
          break;
      }
    }
  } else {
    q += 'name contains \'' + fileName + '\'';
  }
  q += ') and trashed = false';
  return q;
}

function getMultipleFileLinks(files: any[]): void {
  for (var i = 0; i < files.length; i++) {
    files[i]['url'] = utils.getFileLink(
      files[i]['id'],
      files[i]['mimeType'] === 'application/vnd.google-apps.folder'
    );
  }
}

function generateFilesListMessage(files: any[], fileName: string): string {
  var message = '';
  if (files.length > 0) {
    for (var i = 0; i < files.length; i++) {
      message += '<a href = \'' + files[i]['url'] + '\'>' + files[i]['name'] + '</a>';
      if (files[i]['size']) {
        message += ' (' + dlUtils.formatSize(files[i]['size']) + ')';
        //uncomment the below filename === '*' if u want gdindex link ony in 'list *'
        if (/*fileName === '*'  && */ constants.INDEX_DOMAIN) {
          message += ` | <a href="` + constants.INDEX_DOMAIN + encodeURIComponent(files[i]['name']) + `">Index URL</a>`;
        }
        message += '\n';
      } else if (files[i]['mimeType'] === 'application/vnd.google-apps.folder') {
        message += ' (folder)';
        //uncomment the below filename === '*' if u want gdindex link ony in 'list *'
        if (/* fileName === '*' && */ constants.INDEX_DOMAIN) {
          message += ` | <a href="` + constants.INDEX_DOMAIN + encodeURIComponent(files[i]['name']) + `/">Index URL</a>`;
        }
        message += '\n';
      } else {
        message += '\n';
      }

    }
  } else {
    message = 'There are no files matching your parameters';
  }
  return message;
}
