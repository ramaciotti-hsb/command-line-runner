import React from 'react'
import ReactDOM from 'react-dom'
import { Component } from 'react'
import path from 'path'
import marked from 'marked'

const renderer = new marked.Renderer();

renderer.link = ( href, title, text ) => {
    return '<a target="_blank" href="'+ href +'" title="' + title + '" target="_blank">' + text + '</a>';
}

export default class DocumentationView extends Component {

    render () {

        return (
            <div className='panel documentation'>
                <div className='header'>{this.props.title}</div>
                <div className='panel-inner'>
                    <div className='command-actions'>
                        <div className='edit' onClick={this.props.toggleEditModeForItem}>
                            <span className="lnr lnr-pencil"></span>
                            Edit
                        </div>
                        <div className='export' onClick={this.props.exportItemToFile}>
                            <span className="lnr lnr-download"></span>
                            Export
                        </div>
                        <div className='delete' onClick={this.props.deleteItem}>
                            <span className="lnr lnr-cross-circle"></span>
                            Delete
                        </div>
                    </div>
                    <div className='body view' dangerouslySetInnerHTML={{__html: marked(this.props.body, { renderer: renderer })}}></div>
                </div>
            </div>
        )
    }
}