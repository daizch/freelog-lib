var gulp = require('gulp');
var browserify = require('gulp-browserify');
const babel = require('gulp-babel');

gulp.task('build', function() {
  return gulp.src('markdown/index.js')
    .pipe(babel({
      presets: ['env']
    }))
    .pipe(browserify({
      transform: [],
    }))
    .pipe(gulp.dest('./dist/'))
});


gulp.task('default', ['build'])